// Monaco без встроенных языков (только ядро редактора) + BSL.
import "monaco-editor/esm/vs/editor/edcore.main.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import { registerBsl } from "./bsl-language.js";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
registerBsl(monaco);

export default monaco;
