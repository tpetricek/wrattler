import { VNode, h } from "maquette"
import * as monaco from "monaco-editor"
import { Md5 } from "ts-md5"
import { Editor, Env, Expr, bindDataset, emptyEnv, openDatasetAs, parseWithImports } from "@rolyp/fluid"
import { assert } from "../common/log"
import * as Graph from "../definitions/graph"
import * as Langs from "../definitions/languages"
import * as Values from '../definitions/values'
import { createMonacoEditor, createOutputPreview } from "../editors/editor"

// Plugin for Fluid, language for explorable data visualisations.
// https://www.npmjs.com/package/@rolyp/fluid

const fluid: string = "fluid"

Editor.initialise()

/**
 * Eschew the -Kind convention for now.
 */
class FluidBlock implements Langs.Block {
   language: string = fluid
   source: string // needed to compute the hash?
   ρ_e: [Env, Expr] | null

   constructor (source: string) {
      this.source = source
      try {
         this.ρ_e = parseWithImports(source)
      } 
      catch (ex) {
         console.log(ex)
         this.ρ_e = null
      }
   }
}

class FluidState implements Langs.EditorState {
   id: number
   block: FluidBlock
}

class FluidEvent { 
}

class FluidNode implements Graph.Node {
   language: string
   block: FluidBlock
   antecedents: Graph.Node[]
   value: Values.Value | null
   hash: string
   errors: Error[]

   constructor (block: FluidBlock, antecedents: Graph.Node[]) {
      this.language = fluid
      this.block = block
      this.antecedents = antecedents
      this.value = null
      this.hash = Md5.hashStr(block.source) as string // from markdown.ts - revisit?
      this.errors = []
   }
}

// Help TypeScript with mess that is IMonarchLanguageRule.
function rules (rs: monaco.languages.IMonarchLanguageRule[]): monaco.languages.IMonarchLanguageRule[] {
   return rs
}

// Based on example at https://microsoft.github.io/monaco-editor/monarch.html.
class FluidTokensProvider implements monaco.languages.IMonarchLanguage {
   keywords = ["_", "as", "match", "fun", "in", "let", "letrec", "primitive", "typematch"]
   // not really sure how this works but this definition doesn't seem to do much
   operators = [
      "-", "++", "+",            // sumOp
      "**",                      // exponentOp
      "*", "/",                  // productOp
      "==", "<=", "<", ">=", ">" // compareOp
   ]
   symbols = /→|;|,|\.\.\./ // omit = as not sure how to make it cohabit with ===, <=, etc
   tokenizer = {
      root: rules([
         [/[a-zA-Z_][0-9a-zA-Z_]*'*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
         { include: "@whitespace" },
         [/[{}()\[\]]/, "@brackets"],
         [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
         [/\-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[e|E][-|+]?[0-9]+)?/, "number"],
         [/"(?:\\["\\]|[^\n"\\])*"/, "string"],
      ]),
      whitespace: rules([
         [/[ \f\t\r\n]+/, "white"],
         [/\/\/.*$/, "comment"],
      ])
   }
   ignoreCase = false
   defaultToken = "invalid"
}

// "Static" side-effects like this probably best avoided.
monaco.languages.register({ id: fluid })
monaco.languages.setMonarchTokensProvider(fluid, new FluidTokensProvider())

class FluidEditor implements Langs.Editor<FluidState, FluidEvent> {
   initialize (id:number, block: Langs.Block): FluidState {
      if (block instanceof FluidBlock) {
         return { id, block } 
      } else {
         return assert(false)
      }
   }

   update (state: FluidState, event: FluidEvent): FluidState {
      return state
   }

   render (cell: Langs.BlockState, state: FluidState, context: Langs.EditorContext<FluidEvent>): VNode {
      const previewButton: VNode = h("button", {
         class: "preview-button", 
         onclick: () => {
            context.evaluate(cell.editor.id) 
         } 
      }, ["Evaluate!"])
      return h("div", {}, [
         h("div", { key: "ed" }, [
           createMonacoEditor(fluid, state.block.source, cell, context) ]),
         h("div", { key: "prev" }, [
            cell.code.value == null ? 
               previewButton :
               createOutputPreview(
                  cell,
                  (idx: number): void => {}, 
                  0, 
                  cell.code.value as Values.ExportsValue
               )
         ])
       ]);
   }
}

class FluidLanguagePlugin implements Langs.LanguagePlugin, Editor.Listener {
   language = fluid
   iconClassName = "fa fa-chart-area"
   editor = new FluidEditor()

   getDefaultCode (id: number): string {
      return ""
   }

   parse (code: string): FluidBlock {
      return new FluidBlock(code)
   }

   async bind (context: Langs.BindingContext, block: Langs.Block): Promise<Langs.BindingResult> {
      console.log(context.scope)
      if (block instanceof FluidBlock) {
         let antecedents: Graph.Node[]
         if (block.ρ_e === null) {
            antecedents = []
         } else {
            const ys: Set<string> = Expr.freeVars(block.ρ_e[1]),
                  xs: string[] = Object.keys(context.scope).filter(x => (ys as any).has(x)) // ES6 dynamic, ES5 static :-o
            antecedents = xs.map(x => context.scope[x])
         }
         return {
            code: new FluidNode(block, antecedents),
            exports: [],
            resources: []
         }
      } else {
         return assert(false)
      }
   }

   async evaluate (context: Langs.EvaluationContext, node: Graph.Node): Promise<Langs.EvaluationResult> {
      if (node instanceof FluidNode) {
         console.log(node)
         const imports: [string, Values.DataFrame][] = (node.antecedents
            // invariant - only depend on exported nodes:   
            .filter(isExportNode)                          
            // exported values are known and non-null 
            .map(node => [node.variableName, node.value as Values.KnownValue])
            .filter(([x, v]: [string, Values.KnownValue]) => v.kind === "dataframe")) as [string, Values.DataFrame][]
         let ρ_external: Env = emptyEnv()
         for (let [x, { data }] of imports) {
            ρ_external = bindDataset(ρ_external, await data.getValue(), x) // data is any[] but assume Object[]
         }
         // temporarily make specific dataset available as external data too
         ρ_external = ρ_external.concat(openDatasetAs("renewables-restricted", "data"))
         const [ρ_imports, e]: [Env, Expr] = node.block.ρ_e!
         const editor: Editor.Editor = new Editor.Editor(this, [400, 400], "top", ρ_external, ρ_imports, e)
         editor.initialise()
         const exports: Values.ExportsValue = { 
            kind: "exports",
            exports: { 
               "graphics": { 
                  kind: "jsoutput", 
                  render: (id: string): void => {
                     document.getElementById(id)!.appendChild(editor.rootPane)
                  } 
               } 
            }
         }
         return { 
            kind: "success", 
            value: exports
         }
      } else {
         return assert(false)
      }
   }

   onBwdSlice (editor: Editor.Editor, externDeps: Set<Object> /* todo: should be Slice */): void {
   }

   save (block: Langs.Block): string {
      if (block instanceof FluidBlock) {
         return block.source
      } else {
         return assert(false)
      }
   }
}

export const fluidLanguagePlugin: Langs.LanguagePlugin = new FluidLanguagePlugin()

// Dynamic type check.
function isExportNode (node: Graph.Node): node is Graph.ExportNode {
   return (node as Graph.ExportNode).variableName !== undefined
}
