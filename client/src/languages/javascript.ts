import {h,VNode} from 'maquette';
import * as Langs from '../definitions/languages'; 
import * as Graph from '../definitions/graph'; 
import * as Values from '../definitions/values'; 
import {createEditor} from '../editors/editor';

import ts from 'typescript';
import axios from 'axios';
import {Md5} from 'ts-md5';

declare var PYTHONSERVICE_URI: string;
declare var DATASTORE_URI: string;

// ------------------------------------------------------------------------------------------------
// Markdown plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Markdown block. All blocks need to have 
/// `language` and Markdown also keeps the Markdown source we edit and render

class JavascriptBlockKind implements Langs.Block {
    language : string;
    source : string;
    constructor(source:string) {
      this.language = "javascript";
      this.source = source;
    }
  }
  
  function getCodeExports(scopeDictionary: {}, source: string): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}> {
    return new Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>(resolve => {
      let tsSourceFile = ts.createSourceFile(
        __filename,
        source,
        ts.ScriptTarget.Latest
      );
      // let tree = [];

      let dependencies:Graph.JsExportNode[] = [];
      let node:Graph.JsCodeNode = {
        language:"javascript", 
        antecedents:[],
        exportedVariables:[],
        kind: 'code',
        value: undefined,
        source: source
      }

      let walk = function (expr) {
        ts.forEachChild(expr, function(child) 
        { 
          switch(child.kind) {
            case ts.SyntaxKind.VariableStatement:
              let decl = (<ts.VariableStatement>child).declarationList.declarations[0].name
              // REVIEW: This could fail if 'decl' is 'BindingPattern' and not 'Identifier'
              // REVIEW: Also, TypeScript uses some strange '__String' that might not be valid 'string'
              let name = <string>(<ts.Identifier>decl).escapedText 
              let exportNode:Graph.JsExportNode = {
                variableName: name,
                value: undefined,
                language:"javascript",
                code: node, 
                kind: 'export',
                antecedents:[node]
                };
              dependencies.push(exportNode);
              node.exportedVariables.push(exportNode.variableName);
              break;
          
            case ts.SyntaxKind.Identifier:
              // REVIEW: As above, 'escapedText' is actually '__String' which might cause problems 
              let argumentName = <string>(<ts.Identifier>child).escapedText;
              if (argumentName in scopeDictionary) {
                let antecedentNode = scopeDictionary[argumentName]
                if (node.antecedents.indexOf(antecedentNode) == -1)
                  node.antecedents.push(antecedentNode);
              }
              break;
          }
          walk(child)
        })
      }

      walk(tsSourceFile);
      resolve({code: node, exports: dependencies});
    });
  }

  type JavascriptEvent = {}
  
  type JavascriptState = {
    id: number
    block: JavascriptBlockKind
  }
  
  const javascriptEditor : Langs.Editor<JavascriptState, JavascriptEvent> = {
    initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <JavascriptBlockKind>block}
    },
  
    update: (state:JavascriptState, event:JavascriptEvent) => state,
    
    render: (cell: Langs.BlockState, state:JavascriptState, context:Langs.EditorContext<JavascriptEvent>) => {
      let evalButton = h('button', { onclick:() => context.evaluate(cell) }, ["Evaluate"])
      
      let results = h('div', {}, [
        h('p', {
            style: "height:75px; position:relative", 
          }, 
          [ (cell.code.value==undefined) ? evalButton : ("Value is: " + JSON.stringify(cell.code.value)) ]),
      ]);
 
			let code = createEditor("javascript", state.block.source, cell, context)
      return h('div', { }, [code, results])
    },
  }

  export const javascriptLanguagePlugin : Langs.LanguagePlugin = {
    language: "javascript",
    editor: javascriptEditor,
    evaluate: async (node:Graph.Node) : Promise<Values.Value> => {
      let jsnode = <Graph.JsNode>node

      async function putValue(variableName, hash, value) : Promise<string> {
        let url = DATASTORE_URI.concat("/"+hash).concat("/"+variableName)
        let headers = {'Content-Type': 'application/json'}
        try {
          var response = await axios.put(url, value, {headers: headers});
          // return DATASTORE_URI.concat("/"+hash).concat("/"+variableName)
          return "http://wrattler_wrattler_data_store_1:7102".concat("/"+hash).concat("/"+variableName)
        }
        catch (error) {
          console.error(error);
        }
      }

      async function putValues(values) : Promise<Values.ExportsValue> {
        try {
          var results : Values.ExportsValue = {}
          for (let value in values) {
            let dfString = JSON.stringify(values[value])
            let hash = Md5.hashStr(dfString)
            results[value] = {url: await putValue(value, hash, dfString), data: values[value]}
          }
          return results;
        }
        catch (error) {
          console.error(error);
        }
      }

      switch(jsnode.kind) {
        case 'code': 
          let returnArgs = "{";
          let evalCode = "";
          let jsCodeNode = <Graph.JsCodeNode>node
          for (var e = 0; e < jsCodeNode.exportedVariables.length; e++) {
            returnArgs= returnArgs.concat(jsCodeNode.exportedVariables[e]+":"+jsCodeNode.exportedVariables[e]+",");
          }
          returnArgs = returnArgs.concat("}")
          let importedVars = "";
          var argDictionary:{[key: string]: string} = {}
          for (var i = 0; i < jsCodeNode.antecedents.length; i++) {
            let imported = <Graph.JsExportNode>jsCodeNode.antecedents[i]
            console.log(imported);
            argDictionary[imported.variableName] = (<Values.DataFrame>imported.value).data;
            importedVars = importedVars.concat("\nlet "+imported.variableName + " = args[\""+imported.variableName+"\"];");
          }
          evalCode = "function f(args) {\n\t "+ importedVars + "\n"+jsCodeNode.source +"\n\t return "+returnArgs+"\n}; f(argDictionary)"
          console.log(evalCode)
          let values : Values.ExportsValue = eval(evalCode);
          return await putValues(values);
        case 'export':
          let jsExportNode = <Graph.JsExportNode>node
          let exportNodeName= jsExportNode.variableName
          let exportsValue = <Values.ExportsValue>jsExportNode.code.value
          return exportsValue[exportNodeName]
      }
    },
    parse: (code:string) => {
      //console.log(code);
      return new JavascriptBlockKind(code);
    },
    bind: (scopeDictionary: {}, block: Langs.Block) => {
      let jsBlock = <JavascriptBlockKind>block
      return getCodeExports(scopeDictionary, jsBlock.source);
    }
  }

  