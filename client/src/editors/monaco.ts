/** @hidden */

/** This comment is needed so that TypeDoc parses the above one correctly */
import * as monaco from 'monaco-editor';
import * as Langs from '../definitions/languages';
import {h, VNode} from 'maquette';
import { Log } from '../common/log';

function createMonaco(el:HTMLElement, lang:string, source:string, rebindAndEvaluate:any) {
  let ed = monaco.editor.create(el, {
    value: source,
    language: lang,
    scrollBeyondLastLine: false,
    theme:'vs',
    minimap: { enabled: false },
    overviewRulerLanes: 0,
    lineDecorationsWidth: "0ch",
    fontSize: 14,
    fontFamily: 'Roboto Mono',
    lineNumbersMinChars: 2,
    lineHeight: 20,
    lineNumbers: "on",
    scrollbar: {
      verticalHasArrows: true,
      horizontalHasArrows: true,
      vertical: 'hidden',
      horizontal: 'hidden'
    }
  });

  ed.createContextKey('alwaysTrue', true);
  ed.addCommand(monaco.KeyCode.Enter | monaco.KeyMod.Shift,function (e) {
    let model = ed.getModel()
    if (model) rebindAndEvaluate(model.getValue(monaco.editor.EndOfLinePreference.LF))
  }, 'alwaysTrue');

  return ed;
}

function createEditor(lang:string, source:string, cell:Langs.BlockState, context:Langs.EditorContext<any>) {
  
  let afterCreateHandler = (el:HTMLElement) => { 
    Log.trace("editor", "Created Monaco editor for id: %s (code: %s)", el.id, source.replace(/[\n\r]/g," ").substr(0,100))
    let rebindAndEvaluate = (code:string) => { 
      Log.trace("editor", "Rebind + Evaluation triggered by Shift+Enter")
      context.rebindSubsequent(cell, code)
      // Log.trace("editor", "Evaluation triggered by Shift+Enter")
      context.evaluate(cell.editor.id)
    }
    let ed = createMonaco(el, lang, source, rebindAndEvaluate)

    let lastHeight = 100;
    let lastWidth = 0
    let resizeEditor = () => {
      let model = ed.getModel()
      if (model) {
        // Log.trace("editor", "Resize triggered by content change")
        let lines = model.getValue(monaco.editor.EndOfLinePreference.LF, false).split('\n').length
        let height = lines * 20.0;
        let width = el.clientWidth

        if (height !== lastHeight || width !== lastWidth) {
          lastHeight = height
          lastWidth = width
          ed.layout({width:width, height:height})
          el.style.height = height + "px"
        }
      }
    }

    function rebindCells()  {
      let model = ed.getModel() 
      if (model) {
        // Log.trace("editor", "Rebind triggered by Blur event")
        context.rebindSubsequent(cell, model.getValue(monaco.editor.EndOfLinePreference.LF))
      }
    }

    let model = ed.getModel()
    if (model) model.onDidChangeContent(resizeEditor);
    ed.onDidBlurEditorText(rebindCells)
    setTimeout(resizeEditor, 1)
  }

  let afterUpdateHandler = (el:HTMLElement) => { 
    // Log.trace("editor", "Updating Monaco editor for id: %s (code: %s)", el.id, source.replace(/[\n\r]/g," ").substr(0,100))
  }

  return h('div', { id: "editor_" + cell.editor.id.toString(), key: "editor_" + cell.editor.id.toString(), afterCreate:afterCreateHandler, afterUpdate:afterUpdateHandler }, [ ])
}

export {
  createEditor
}
