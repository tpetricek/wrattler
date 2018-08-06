import * as monaco from 'monaco-editor';
import {h,createProjector,VNode} from 'maquette';
import * as Langs from '../../languages'; 
import * as Graph from '../../graph'; 
const ts = require('typescript');

// ------------------------------------------------------------------------------------------------
// Python plugin
// ------------------------------------------------------------------------------------------------

/// A class that represents a Python block. All blocks need to have 
/// `language` and Python also keeps the Python source we edit and render

class PythonBlockKind implements Langs.Block {
    language : string;
    source : string;
    constructor(source:string) {
      this.language = "python";
      this.source = source;
    }
  }
  
  function getCodeExports(scopeDictionary: {}, source: string): Promise<{code: Graph.Node, exports: Graph.ExportNode[]}> {
    return new Promise<{code: Graph.Node, exports: Graph.ExportNode[]}>(resolve => {
      let dependencies:Graph.PyExportNode[] = [];
      let node:Graph.PyCodeNode = {
        language:"python", 
        antecedents:[],
        exportedVariables:[],
        kind: 'code',
        value: undefined,
        source: source
      }
      resolve({code: node, exports: dependencies});
    });
  }

  interface PythonEditEvent { kind:'edit' }
  interface PythonUpdateEvent { kind:'update', source:string }
  type PythonEvent = PythonEditEvent | PythonUpdateEvent
  
  type PythonState = {
    id: number
    block: PythonBlockKind
    editing: boolean
  }
  
  const pythonEditor : Langs.Editor<PythonState, PythonEvent> = {
    initialize: (id:number, block:Langs.Block) => {  
      return { id: id, block: <PythonBlockKind>block, editing: false }
    },
  
    update: (state:PythonState, event:PythonEvent) => {
      switch(event.kind) {
        case 'edit': 
          // console.log("Python: Switch to edit mode!")
          return { id: state.id, block: state.block, editing: true }
        case 'update': 
          // console.log("Python: Set code to:\n%O", event.source);
          let newBlock = pythonLanguagePlugin.parse(event.source)
          return { id: state.id, block: <PythonBlockKind>newBlock, editing: false }
      }
    },

    render: (cell: Langs.BlockState, state:PythonState, context:Langs.EditorContext<PythonEvent>) => {
      let evalButton = h('button', { onclick:() => context.evaluate(cell) }, ["Evaluate"])
      let results = h('div', {}, [
        h('p', {
            style: "height:75px; position:relative", 
            onclick:() => context.trigger({kind:'edit'})
          }, 
          [ ((cell.code==undefined)||(cell.code.value==undefined)) ? evalButton : ("Value is: " + JSON.stringify(cell.code.value)) ]),
      ]);
 
      let afterCreateHandler = (el) => { 
        let ed = monaco.editor.create(el, {
          value: state.block.source,
          language: 'python',
          scrollBeyondLastLine: false,
          theme:'vs',
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          lineDecorationsWidth: "0ch",
          fontSize: 14,
          fontFamily: 'Monaco',
          lineNumbersMinChars: 2,
          lineHeight: 20,
          lineNumbers: "on",
          scrollbar: {
            verticalHasArrows: true,
            horizontalHasArrows: true,
            vertical: 'none',
            horizontal: 'none'
          }
        });    

        ed.createContextKey('alwaysTrue', true);
        ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
          let code = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF)
          context.trigger({kind: 'update', source: code})
        }, 'alwaysTrue');

        let lastHeight = 100;
        let lastWidth = 0
        let resizeEditor = () => {
          let lines = ed.getModel().getValue(monaco.editor.EndOfLinePreference.LF, false).split('\n').length
          let height = lines > 4 ? lines * 20.0 : 80;
          let width = el.clientWidth

          if (height !== lastHeight || width !== lastWidth) {
            lastHeight = height
            lastWidth = width  
            ed.layout({width:width, height:height})
            el.style.height = height + "px"
          }
        }
        ed.getModel().onDidChangeContent(resizeEditor);
        window.addEventListener("resize", resizeEditor)
        setTimeout(resizeEditor, 100)
      }
      let code = h('div', { style: "height:100px; margin:20px 0px 10px 0px;", id: "editor_" + cell.editor.id.toString(), afterCreate:afterCreateHandler }, [ ])
      return h('div', { }, [code, results])
    }
  }

  export const pythonLanguagePlugin : Langs.LanguagePlugin = {
    language: "python",
    editor: pythonEditor,
    evaluate: (node:Graph.Node) => {
      let pynode = <Graph.PyNode>node
      let value = "yadda";
      let returnArgs = "{";
      let evalCode = "";
      switch(pynode.kind) {
        case 'code': 
          value = "";
          break;
        case 'export':
          let pyExportNode = <Graph.PyExportNode>node
          let exportNodeName= pyExportNode.variableName;
          value = pyExportNode.code.value[exportNodeName]
          break;
      }
      return value
    },
    parse: (code:string) => {
      return new PythonBlockKind(code);
    },
    bind: (scopeDictionary: {}, block: Langs.Block) => {
      let pyBlock = <PythonBlockKind>block
      return getCodeExports(scopeDictionary, pyBlock.source);
    }
  }