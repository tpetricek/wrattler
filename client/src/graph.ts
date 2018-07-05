interface Node {
  language: string
  antecedents: Node[]
}

interface JsCodeNode extends Node { 
  code: string
}

interface JsExportNode extends Node { 
  variableName: string
  code: Node
  dependencies: Node[]
}

export {
  Node,
  JsCodeNode,
  JsExportNode
}