// In-memory database fallback for local development (no PostgreSQL required).
// Mimics the subset of the drizzle-orm query builder API used in server.ts.

const NAME_SYM = Symbol.for("drizzle:Name");

function isColumn(c: any): boolean {
  return (
    c &&
    typeof c === "object" &&
    typeof c.name === "string" &&
    c.table !== undefined &&
    typeof c.constructor?.name === "string" &&
    c.constructor.name.startsWith("Pg")
  );
}

function isParam(c: any): boolean {
  return c && typeof c === "object" && c.constructor?.name === "Param";
}

function isStringChunk(c: any): boolean {
  return c && typeof c === "object" && c.constructor?.name === "StringChunk";
}

function defaultFor(c: any): any {
  if (typeof c.defaultFn === "function") return c.defaultFn();
  if (c.default && c.default.queryChunks) return new Date(); // defaultNow()
  if (c.default !== undefined) return c.default;
  return null;
}

function parseLiteral(s: string): any {
  const t = s.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Reconstruct a SQL template string, replacing column refs with "@COL@".
function sqlToTemplate(sql: any): { text: string; cols: any[] } {
  let text = "";
  const cols: any[] = [];
  for (const c of sql.queryChunks || []) {
    if (isColumn(c)) {
      text += "@COL@";
      cols.push(c);
    } else if (isStringChunk(c)) {
      text += c.value.join("");
    } else if (isParam(c)) {
      text += JSON.stringify(c.value);
    } else if (typeof c === "number" || typeof c === "boolean") {
      text += String(c);
    } else if (c && c.queryChunks) {
      const sub = sqlToTemplate(c);
      text += sub.text;
      cols.push(...sub.cols);
    } else {
      text += "?";
    }
  }
  return { text, cols };
}

class Table {
  name: string;
  rows: any[] = [];
  seq = 1;
  colToProp = new Map<any, string>();
  props: Record<string, any> = {};

  constructor(table: any) {
    this.name = table[NAME_SYM] || "unknown";
    for (const k of Object.getOwnPropertyNames(table)) {
      if (k === "enableRLS") continue;
      const v = table[k];
      if (isColumn(v)) {
        this.colToProp.set(v, k);
        this.props[k] = v;
      }
    }
  }

  propFor(col: any): string {
    const p = this.colToProp.get(col);
    if (p) return p;
    for (const [k, v] of Object.entries(this.props)) {
      if ((v as any).name === col.name) return k;
    }
    return col.name;
  }

  makeRow(partial: any): any {
    const row: any = {};
    for (const [prop, col] of Object.entries(this.props)) {
      const c = col as any;
      let val = partial[prop];
      if (val === undefined) {
        if (c.primary) val = this.seq++;
        else if (c.hasDefault) val = defaultFor(c);
        else val = null;
      }
      row[prop] = val;
    }
    return row;
  }
}

class JoinedRow {
  private map = new Map<Table, any>();

  constructor(t?: Table, row?: any) {
    if (t && row) this.map.set(t, row);
  }

  set(t: Table, row: any) {
    this.map.set(t, row);
  }

  clone(): JoinedRow {
    const n = new JoinedRow();
    n.map = new Map(this.map);
    return n;
  }

  tableFor(col: any): Table | undefined {
    for (const t of this.map.keys()) {
      if (t.colToProp.has(col)) return t;
    }
    for (const t of this.map.keys()) {
      for (const v of Object.values(t.props)) {
        if ((v as any).name === col.name) return t;
      }
    }
    return this.map.keys().next().value;
  }

  value(col: any): any {
    const t = this.tableFor(col);
    if (!t) return undefined;
    const row = this.map.get(t);
    if (!row) return undefined;
    return row[t.propFor(col)];
  }

  toPlain(): any {
    return this.map.values().next().value;
  }
}

function collectPreds(sql: any, preds: ((row: JoinedRow) => boolean)[]) {
  if (!sql || !sql.queryChunks) return;
  const chunks = sql.queryChunks;
  const cols = chunks.filter(isColumn);
  const params = chunks.filter(isParam);
  if (cols.length === 1 && params.length === 1) {
    const col = cols[0];
    const val = params[0].value;
    preds.push((row) => row.value(col) === val);
    return;
  }
  for (const c of chunks) {
    if (c && c.queryChunks) collectPreds(c, preds);
  }
}

function predicateFromCondition(sql: any): (row: JoinedRow) => boolean {
  const preds: ((row: JoinedRow) => boolean)[] = [];
  collectPreds(sql, preds);
  return (row) => preds.every((p) => p(row));
}

function extractEqColumns(sql: any): [any, any] | null {
  if (!sql || !sql.queryChunks) return null;
  const cols = sql.queryChunks.filter(isColumn);
  if (cols.length === 2) return [cols[0], cols[1]];
  return null;
}

function orderByInfo(sql: any): { col: any; dir: "asc" | "desc" } {
  const col = (sql.queryChunks || []).find(isColumn);
  const text = (sql.queryChunks || [])
    .filter(isStringChunk)
    .map((c: any) => c.value.join(""))
    .join("");
  return { col, dir: text.includes(" desc") ? "desc" : "asc" };
}

function evaluateAggregate(sql: any, group: JoinedRow[]): any {
  const { text, cols } = sqlToTemplate(sql);
  if (text.trim() === "count(*)") return group.length;
  let m = text.match(/^count\(distinct @COL@\)$/);
  if (m) {
    const s = new Set(group.map((r) => r.value(cols[0])));
    return s.size;
  }
  m = text.match(/^avg\(@COL@\)$/);
  if (m) {
    const vals = group.map((r) => r.value(cols[0])).filter((v) => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  m = text.match(/^sum\(case when @COL@ = (.+) then (.+) else (.+) end\)$/);
  if (m) {
    const cmp = parseLiteral(m[1]);
    const thenV = parseLiteral(m[2]);
    const elseV = parseLiteral(m[3]);
    let sum = 0;
    for (const r of group) {
      sum += r.value(cols[0]) === cmp ? thenV : elseV;
    }
    return sum;
  }
  return null;
}

function evaluateSetValue(value: any, row: any, table: Table): any {
  if (value && value.queryChunks) {
    const { text, cols } = sqlToTemplate(value);
    const m = text.match(/^@COL@ \+ (.+)$/);
    if (m && cols.length === 1) {
      const delta = parseLiteral(m[1]);
      const prop = table.propFor(cols[0]);
      const cur = row[prop] || 0;
      return cur + delta;
    }
    return null;
  }
  return value;
}

function makeThenable(execute: () => any, extra?: Record<string, any>): any {
  const thenable: any = {
    then(resolve: any, reject: any) {
      return Promise.resolve().then(execute).then(resolve, reject);
    },
    catch(reject: any) {
      return Promise.resolve().then(execute).catch(reject);
    },
  };
  if (extra) Object.assign(thenable, extra);
  return thenable;
}

class InsertBuilder {
  private t: Table;
  constructor(t: Table) {
    this.t = t;
  }

  values(v: any) {
    const t = this.t;
    const input = Array.isArray(v) ? v : [v];

    const insert = () => {
      const rows = input.map((x) => t.makeRow(x));
      t.rows.push(...rows);
      return rows;
    };

    const upsert = (target: any, set: any) => {
      const targetProps = (Array.isArray(target) ? target : [target]).map((c: any) =>
        t.propFor(c)
      );
      const result: any[] = [];
      for (const x of input) {
        const row = t.makeRow(x);
        const idx = t.rows.findIndex((r) => targetProps.every((p) => r[p] === row[p]));
        if (idx >= 0) {
          t.rows[idx] = { ...t.rows[idx], ...set };
          result.push(t.rows[idx]);
        } else {
          t.rows.push(row);
          result.push(row);
        }
      }
      return result;
    };

    return makeThenable(insert, {
      returning: () => Promise.resolve(insert()),
      onConflictDoUpdate: (opts: any) => ({
        returning: () => Promise.resolve(upsert(opts.target, opts.set)),
      }),
    });
  }
}

class SelectBuilder {
  private db: MemoryDB;
  private fields: any[];
  private _from: Table | null = null;
  private _where: any = null;
  private _orderBy: any = null;
  private _limit: number | null = null;
  private _join: { table: Table; cond: any } | null = null;
  private _groupBy: any = null;

  constructor(db: MemoryDB, fields: any[]) {
    this.db = db;
    this.fields = fields;
  }

  from(t: any) {
    this._from = this.db.getTable(t);
    return this;
  }
  where(c: any) {
    this._where = c;
    return this;
  }
  orderBy(c: any) {
    this._orderBy = c;
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  innerJoin(t2: any, cond: any) {
    this._join = { table: this.db.getTable(t2), cond };
    return this;
  }
  groupBy(c: any) {
    this._groupBy = c;
    return this;
  }

  hasAggregate(): boolean {
    const spec = this.fields[0];
    if (!spec || typeof spec !== "object") return false;
    return Object.values(spec).some((v: any) => v && v.queryChunks && !isColumn(v));
  }

  private buildRows(): JoinedRow[] {
    const from = this._from!;
    let rows: JoinedRow[] = from.rows.map((r) => new JoinedRow(from, r));

    if (this._join) {
      const { table: jt, cond } = this._join;
      const eqCols = extractEqColumns(cond);
      const newRows: JoinedRow[] = [];
      for (const base of rows) {
        for (const jr of jt.rows) {
          const joined = base.clone();
          joined.set(jt, jr);
          if (eqCols) {
            if (joined.value(eqCols[0]) === joined.value(eqCols[1])) newRows.push(joined);
          } else {
            newRows.push(joined);
          }
        }
      }
      rows = newRows;
    }

    if (this._where) {
      const pred = predicateFromCondition(this._where);
      rows = rows.filter(pred);
    }

    return rows;
  }

  private project(group: JoinedRow[]): any {
    if (this.fields.length === 0) {
      return group[0].toPlain();
    }
    const spec = this.fields[0];
    const out: any = {};
    for (const alias of Object.keys(spec)) {
      const field = spec[alias];
      if (isColumn(field)) out[alias] = group[0].value(field);
      else if (field && field.queryChunks) out[alias] = evaluateAggregate(field, group);
      else out[alias] = null;
    }
    return out;
  }

  execute(): any[] {
    let rows = this.buildRows();

    if (this._groupBy) {
      const groups = new Map<any, JoinedRow[]>();
      for (const r of rows) {
        const k = r.value(this._groupBy);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r);
      }
      return [...groups.values()].map((g) => this.project(g));
    }

    if (this.hasAggregate()) {
      return [this.project(rows)];
    }

    if (this._orderBy) {
      const { col, dir } = orderByInfo(this._orderBy);
      rows = rows.slice().sort((a, b) => {
        const av = a.value(col);
        const bv = b.value(col);
        if (av == null || bv == null) return 0;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === "desc" ? -cmp : cmp;
      });
    }

    if (this._limit != null) rows = rows.slice(0, this._limit);

    return rows.map((r) => this.project([r]));
  }

  then(resolve: any, reject: any) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }
  catch(reject: any) {
    return Promise.resolve().then(() => this.execute()).catch(reject);
  }
}

class UpdateBuilder {
  private t: Table;
  private _set: any = null;
  private _where: any = null;

  constructor(t: Table) {
    this.t = t;
  }
  set(s: any) {
    this._set = s;
    return this;
  }
  where(c: any) {
    this._where = c;
    return this;
  }

  private apply(): any[] {
    const pred = this._where ? predicateFromCondition(this._where) : () => true;
    const updated: any[] = [];
    for (const row of this.t.rows) {
      if (pred(new JoinedRow(this.t, row))) {
        for (const k of Object.keys(this._set)) {
          row[k] = evaluateSetValue(this._set[k], row, this.t);
        }
        updated.push(row);
      }
    }
    return updated;
  }

  returning() {
    return Promise.resolve(this.apply());
  }
  then(resolve: any, reject: any) {
    return Promise.resolve().then(() => this.apply()).then(resolve, reject);
  }
  catch(reject: any) {
    return Promise.resolve().then(() => this.apply()).catch(reject);
  }
}

class DeleteBuilder {
  private t: Table;
  private _where: any = null;

  constructor(t: Table) {
    this.t = t;
  }
  where(c: any) {
    this._where = c;
    return this;
  }

  private apply() {
    const pred = this._where ? predicateFromCondition(this._where) : () => true;
    this.t.rows = this.t.rows.filter((row) => !pred(new JoinedRow(this.t, row)));
  }

  then(resolve: any, reject: any) {
    return Promise.resolve().then(() => this.apply()).then(resolve, reject);
  }
  catch(reject: any) {
    return Promise.resolve().then(() => this.apply()).catch(reject);
  }
}

export class MemoryDB {
  private tables = new Map<string, Table>();

  getTable(t: any): Table {
    const name = t[NAME_SYM] || "unknown";
    if (!this.tables.has(name)) this.tables.set(name, new Table(t));
    return this.tables.get(name)!;
  }

  insert(table: any) {
    return new InsertBuilder(this.getTable(table));
  }

  select(...fields: any[]) {
    return new SelectBuilder(this, fields);
  }

  update(table: any) {
    return new UpdateBuilder(this.getTable(table));
  }

  delete(table: any) {
    return new DeleteBuilder(this.getTable(table));
  }
}
