// =============================
// Mini Compiler (Browser Version)
// Tasks 2–6 outputs
// Supports:
//  - Declarations: int x; float y;
//  - Assignments: x = 10 + 2 * y;
//  - Expressions: + - * / ( )
// =============================

// ---------- UI wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  const compileBtn = document.getElementById("compileBtn");
  const codeInput = document.getElementById("codeInput");

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const outputs = {
    tokens: document.getElementById("out_tokens"),
    symbols: document.getElementById("out_symbols"),
    parse: document.getElementById("out_parse"),
    semantic: document.getElementById("out_semantic"),
    ir: document.getElementById("out_ir"),
    opt: document.getElementById("out_opt"),
  };

  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const key = t.dataset.tab;

      Object.values(outputs).forEach(o => o.classList.remove("active"));
      outputs[key].classList.add("active");
    });
  });

  compileBtn.addEventListener("click", () => {
    const source = codeInput.value;
    const result = compile(source);

    outputs.tokens.textContent = result.tokensText;
    outputs.symbols.textContent = result.symbolsText;
    outputs.parse.textContent = result.parseText;
    outputs.semantic.textContent = result.semanticText;
    outputs.ir.textContent = result.irText;
    outputs.opt.textContent = result.optText;
  });
});

// ---------- Compiler main ----------
function compile(source) {
  // Task 2: Lexical
  let tokens, lexErrors = [];
  try {
    tokens = tokenize(source);
  } catch (e) {
    tokens = [];
    lexErrors.push(String(e.message || e));
  }

  // Token output (Task 2)
  const tokensText = lexErrors.length
    ? "LEXICAL ERROR(S):\n" + lexErrors.map(e => "- " + e).join("\n")
    : tokens.map(t => `${padRight(t.type, 10)}  ${JSON.stringify(t.value)}  (line ${t.line})`).join("\n");

  // Parse + build AST + symbol table
  let ast = null, parseErrors = [];
  let symbolTable = new Map(); // name -> {type, declaredLine}
  try {
    const parser = new Parser(tokens);
    ast = parser.parseProgram();
    parseErrors = parser.errors;
  } catch (e) {
    parseErrors.push(String(e.message || e));
  }

  const parseText = parseErrors.length
    ? "SYNTAX ERROR(S):\n" + parseErrors.map(e => "- " + e).join("\n")
    : "Parsing Successful ✅\n\nAST Summary:\n" + prettyAST(ast);

  // Semantic analysis (Task 4)
  const sem = semanticAnalyze(ast);
  const semanticText = sem.errors.length
    ? "SEMANTIC ERROR(S):\n" + sem.errors.map(e => "- " + e).join("\n")
    : "Semantic Analysis Passed ✅\n\nNotes:\n" + (sem.notes.length ? sem.notes.map(n => "- " + n).join("\n") : "- No issues detected.");

  symbolTable = sem.symbolTable;

  const symbolsText = formatSymbolTable(symbolTable);

  // IR (Task 5)
  const ir = generateTAC(ast, symbolTable);
  const irText = ir.errors.length
    ? "IR GENERATION ERROR(S):\n" + ir.errors.map(e => "- " + e).join("\n")
    : formatIR(ir);

  // Optimization (Task 6): constant folding + dead temp elimination
  const opt = optimizeTAC(ir.tac);
  const optText = formatOptimized(ir.tac, opt);

  return {
    tokensText,
    symbolsText,
    parseText,
    semanticText,
    irText,
    optText
  };
}

// =============================
// TASK 2: LEXER
// =============================
function tokenize(src) {
  const keywords = new Set(["int", "float"]);
  const tokens = [];
  let i = 0, line = 1;

  const push = (type, value) => tokens.push({ type, value, line });

  while (i < src.length) {
    const c = src[i];

    // whitespace
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "\n") { line++; i++; continue; }

    // comments //...
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    // identifiers / keywords
    if (isAlpha(c) || c === "_") {
      let start = i;
      while (i < src.length && (isAlphaNum(src[i]) || src[i] === "_")) i++;
      const word = src.slice(start, i);
      if (keywords.has(word)) push("KW", word);
      else push("ID", word);
      continue;
    }

    // numbers (int/float)
    if (isDigit(c)) {
      let start = i;
      while (i < src.length && isDigit(src[i])) i++;
      if (src[i] === ".") {
        i++;
        while (i < src.length && isDigit(src[i])) i++;
        push("NUM", src.slice(start, i)); // float
      } else {
        push("NUM", src.slice(start, i)); // int
      }
      continue;
    }

    // operators and punctuation
    const single = {
      "+": "PLUS",
      "-": "MINUS",
      "*": "MUL",
      "/": "DIV",
      "=": "ASSIGN",
      ";": "SEMI",
      "(": "LP",
      ")": "RP"
    };
    if (single[c]) { push(single[c], c); i++; continue; }

    throw new Error(`Unexpected character '${c}' at line ${line}`);
  }

  push("EOF", "");
  return tokens;
}

function isAlpha(ch){ return /[A-Za-z]/.test(ch); }
function isDigit(ch){ return /[0-9]/.test(ch); }
function isAlphaNum(ch){ return /[A-Za-z0-9]/.test(ch); }

// =============================
// TASK 3: PARSER (Recursive Descent)
// Grammar (simplified):
// program  -> stmt* EOF
// stmt     -> decl | assign
// decl     -> (int|float) ID ';'
// assign   -> ID '=' expr ';'
// expr     -> term ((+|-) term)*
// term     -> factor ((*|/) factor)*
// factor   -> NUM | ID | '(' expr ')'
// =============================
class Parser {
  constructor(tokens){
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
  }

  cur(){ return this.tokens[this.pos]; }
  eat(type){
    const t = this.cur();
    if (t.type === type) { this.pos++; return t; }
    this.errors.push(`Expected ${type} but found ${t.type} at line ${t.line}`);
    // attempt recovery
    this.pos++;
    return t;
  }

  parseProgram(){
    const stmts = [];
    while (this.cur().type !== "EOF") {
      const s = this.parseStmt();
      if (s) stmts.push(s);
    }
    return { kind: "Program", stmts };
  }

  parseStmt(){
    const t = this.cur();
    if (t.type === "KW") return this.parseDecl();
    if (t.type === "ID") return this.parseAssign();
    this.errors.push(`Unexpected token ${t.type} at line ${t.line}`);
    this.pos++;
    return null;
  }

  parseDecl(){
    const kw = this.eat("KW");
    const id = this.eat("ID");
    this.eat("SEMI");
    return { kind: "Decl", varType: kw.value, name: id.value, line: kw.line };
  }

  parseAssign(){
    const id = this.eat("ID");
    this.eat("ASSIGN");
    const expr = this.parseExpr();
    this.eat("SEMI");
    return { kind: "Assign", name: id.value, expr, line: id.line };
  }

  parseExpr(){
    let node = this.parseTerm();
    while (this.cur().type === "PLUS" || this.cur().type === "MINUS") {
      const op = this.cur(); this.pos++;
      const right = this.parseTerm();
      node = { kind: "Bin", op: op.value, left: node, right };
    }
    return node;
  }

  parseTerm(){
    let node = this.parseFactor();
    while (this.cur().type === "MUL" || this.cur().type === "DIV") {
      const op = this.cur(); this.pos++;
      const right = this.parseFactor();
      node = { kind: "Bin", op: op.value, left: node, right };
    }
    return node;
  }

  parseFactor(){
    const t = this.cur();

    if (t.type === "NUM") { this.pos++; return { kind: "Num", value: t.value, line: t.line }; }
    if (t.type === "ID") { this.pos++; return { kind: "Var", name: t.value, line: t.line }; }

    if (t.type === "LP") {
      this.pos++;
      const node = this.parseExpr();
      this.eat("RP");
      return node;
    }

    this.errors.push(`Invalid factor at line ${t.line} (found ${t.type})`);
    this.pos++;
    return { kind: "Num", value: "0", line: t.line }; // recovery
  }
}

function prettyAST(ast){
  if (!ast) return "No AST produced.";
  return ast.stmts.map((s, idx) => `${idx+1}. ${astLine(s)}`).join("\n");
}
function astLine(s){
  if (s.kind === "Decl") return `Decl ${s.varType} ${s.name}`;
  if (s.kind === "Assign") return `Assign ${s.name} = ${exprToStr(s.expr)}`;
  return s.kind;
}
function exprToStr(e){
  if (!e) return "?";
  if (e.kind === "Num") return e.value;
  if (e.kind === "Var") return e.name;
  if (e.kind === "Bin") return `(${exprToStr(e.left)} ${e.op} ${exprToStr(e.right)})`;
  return "?";
}

// =============================
// TASK 4: SEMANTIC ANALYSIS
// - multiple declaration
// - undeclared variable usage
// - basic type notes (int/float) based on literals
// =============================
function semanticAnalyze(ast){
  const symbolTable = new Map();
  const errors = [];
  const notes = [];

  if (!ast) {
    return { symbolTable, errors: ["No AST (parsing failed)."], notes };
  }

  for (const stmt of ast.stmts) {
    if (stmt.kind === "Decl") {
      if (symbolTable.has(stmt.name)) {
        const prev = symbolTable.get(stmt.name);
        errors.push(`Multiple declaration of '${stmt.name}' at line ${stmt.line} (previous at line ${prev.declaredLine}).`);
      } else {
        symbolTable.set(stmt.name, { type: stmt.varType, declaredLine: stmt.line });
      }
    }

    if (stmt.kind === "Assign") {
      if (!symbolTable.has(stmt.name)) {
        errors.push(`Undeclared variable '${stmt.name}' used on left side at line ${stmt.line}.`);
      }
      checkExprVars(stmt.expr, symbolTable, errors);
    }
  }

  if (!errors.length) notes.push("All identifiers are declared before use.");

  return { symbolTable, errors, notes };
}

function checkExprVars(expr, table, errors){
  if (!expr) return;
  if (expr.kind === "Var") {
    if (!table.has(expr.name)) {
      errors.push(`Undeclared variable '${expr.name}' used in expression at line ${expr.line}.`);
    }
  } else if (expr.kind === "Bin") {
    checkExprVars(expr.left, table, errors);
    checkExprVars(expr.right, table, errors);
  }
}

function formatSymbolTable(table){
  if (!table || table.size === 0) return "Symbol Table is empty.";
  const rows = [];
  rows.push(padRight("NAME", 18) + padRight("TYPE", 10) + "DECL_LINE");
  rows.push("-".repeat(44));
  for (const [name, info] of table.entries()) {
    rows.push(padRight(name, 18) + padRight(info.type, 10) + info.declaredLine);
  }
  return rows.join("\n");
}

// =============================
// TASK 5: IR (Three Address Code)
// Also prints quadruples
// =============================
function generateTAC(ast, symbolTable){
  const tac = [];
  const quads = [];
  const errors = [];
  let tempId = 1;

  if (!ast) return { tac: [], quads: [], errors: ["No AST for IR generation."] };

  const newTemp = () => `t${tempId++}`;

  const emit = (line) => tac.push(line);
  const emitQuad = (op, arg1, arg2, res) => quads.push({ op, arg1, arg2, res });

  function genExpr(e){
    if (e.kind === "Num") return e.value;
    if (e.kind === "Var") return e.name;
    if (e.kind === "Bin") {
      const a = genExpr(e.left);
      const b = genExpr(e.right);
      const t = newTemp();
      emit(`${t} = ${a} ${e.op} ${b}`);
      emitQuad(e.op, a, b, t);
      return t;
    }
    return "0";
  }

  for (const stmt of ast.stmts) {
    if (stmt.kind === "Decl") continue;
    if (stmt.kind === "Assign") {
      const rhs = genExpr(stmt.expr);
      emit(`${stmt.name} = ${rhs}`);
      emitQuad("=", rhs, "", stmt.name);
    }
  }

  // basic undeclared protection note
  // (semantic already checks; here just keep safe)
  for (const stmt of ast.stmts) {
    if (stmt.kind === "Assign" && !symbolTable.has(stmt.name)) {
      errors.push(`IR: cannot assign to undeclared variable '${stmt.name}'`);
    }
  }

  return { tac, quads, errors };
}

function formatIR(ir){
  const out = [];
  out.push("Three Address Code (TAC):");
  out.push("-".repeat(26));
  ir.tac.forEach((l, idx) => out.push(`${padRight(String(idx+1)+".", 4)} ${l}`));

  out.push("\nQuadruples:");
  out.push("-".repeat(26));
  out.push(padRight("op", 6) + padRight("arg1", 12) + padRight("arg2", 12) + "res");
  out.push("-".repeat(44));
  ir.quads.forEach(q => out.push(padRight(q.op, 6) + padRight(q.arg1, 12) + padRight(q.arg2, 12) + q.res));

  return out.join("\n");
}

// =============================
// TASK 6: OPTIMIZATION
// 1) Constant folding for TAC temp assignments: t = num op num
// 2) Dead temp elimination: remove temps never used later
// =============================
function optimizeTAC(tac){
  let folded = tac.map(line => line);

  // constant folding pass
  folded = folded.map(line => {
    // match: tX = A op B where A,B are numeric literals
    const m = line.match(/^(t\d+)\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*([\+\-\*\/])\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
    if (!m) return line;
    const t = m[1], a = parseFloat(m[2]), op = m[3], b = parseFloat(m[4]);

    let val;
    if (op === "+") val = a + b;
    else if (op === "-") val = a - b;
    else if (op === "*") val = a * b;
    else if (op === "/") val = b === 0 ? NaN : a / b;

    if (!Number.isFinite(val)) return line;
    // keep integer looking nice
    const vStr = (Math.abs(val - Math.round(val)) < 1e-10) ? String(Math.round(val)) : String(val);
    return `${t} = ${vStr}`;
  });

  // dead temp elimination
  const used = new Set();
  // gather usage: any token t\d+ on RHS counts
  for (const line of folded) {
    const rhs = line.split("=").slice(1).join("=");
    if (!rhs) continue;
    const temps = rhs.match(/\bt\d+\b/g);
    if (temps) temps.forEach(x => used.add(x));
  }

  const cleaned = [];
  for (const line of folded) {
    const lhsMatch = line.match(/^(t\d+)\s*=/);
    if (lhsMatch) {
      const lhs = lhsMatch[1];
      if (!used.has(lhs)) {
        // dead temp, skip
        continue;
      }
    }
    cleaned.push(line);
  }

  return { folded, cleaned };
}

function formatOptimized(originalTac, opt){
  const out = [];
  out.push("Original TAC:");
  out.push("-".repeat(20));
  if (!originalTac.length) out.push("(empty)");
  else originalTac.forEach((l, i) => out.push(`${padRight(String(i+1)+".", 4)} ${l}`));

  out.push("\nAfter Constant Folding:");
  out.push("-".repeat(26));
  if (!opt.folded.length) out.push("(empty)");
  else opt.folded.forEach((l, i) => out.push(`${padRight(String(i+1)+".", 4)} ${l}`));

  out.push("\nAfter Dead Temp Elimination:");
  out.push("-".repeat(30));
  if (!opt.cleaned.length) out.push("(empty)");
  else opt.cleaned.forEach((l, i) => out.push(`${padRight(String(i+1)+".", 4)} ${l}`));

  return out.join("\n");
}

// ---------- helpers ----------
function padRight(s, n){
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}
