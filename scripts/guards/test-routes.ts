import ts from "typescript";
const METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
export function unguardedTestHandlers(source: string): string[] {
  const file = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const failures: string[] = [];
  const exported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement) && exported(statement))
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !METHODS.has(decl.name.text))
          continue;
        const init = decl.initializer;
        let safe = false;
        if (
          init &&
          ts.isCallExpression(init) &&
          ts.isIdentifier(init.expression) &&
          init.expression.text === "route"
        ) {
          const opts = init.arguments[0];
          if (opts && ts.isObjectLiteralExpression(opts))
            safe = opts.properties.some(
              (p) =>
                ts.isPropertyAssignment(p) &&
                p.name.getText(file) === "testOnly" &&
                p.initializer.kind === ts.SyntaxKind.TrueKeyword,
            );
        }
        if (!safe) failures.push(decl.name.text);
      }
    if (
      ts.isFunctionDeclaration(statement) &&
      exported(statement) &&
      statement.name &&
      METHODS.has(statement.name.text)
    )
      failures.push(statement.name.text);
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        if (METHODS.has(element.name.text)) failures.push(element.name.text);
  }
  return failures;
}
