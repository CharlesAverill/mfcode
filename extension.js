const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const terminalName = "mfcode";

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function preview() {
    const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor');
            return;
        }

        var terminal = vscode.window.terminals.find((terminal) => terminal.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
        }

        terminal.sendText(`cd "${path.dirname(editor.document.fileName)}"`);
        var baseName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
        terminal.sendText(`gftodvi "${baseName}"*gf`)
        terminal.sendText(`dvipdf "${baseName}".dvi`);
        terminal.sendText(`pdftoppm "${baseName}".pdf ".${baseName}" -png`);
        terminal.sendText(`rm "${baseName}".pdf`);
        terminal.sendText(`for file in ."${baseName}"*.png; do convert "$file" -trim "$file"; done`);
        terminal.show();

        await delay(3000);

        const panel = vscode.window.createWebviewPanel(
          'metafontPreview',
          'METAFONT Preview',
          vscode.ViewColumn.Two,
          {}
        );

        // Find all matching PNG files
        const matchingFiles = fs.readdirSync(path.dirname(editor.document.fileName))
            .filter(file => file.startsWith(`.${baseName}-`) && file.endsWith('.png'));

        // Read and convert each matching file to base64
        const base64Images = matchingFiles.map(file => {
            const filePath = path.join(path.dirname(editor.document.fileName), file);
            return fs.readFileSync(filePath, 'base64');
        });

        panel.webview.html = getWebviewContent(base64Images);
        console.log(getWebviewContent(base64Images));
}

async function compileAndPreview() {
    vscode.commands.executeCommand('mfcode.compile');
    vscode.commands.executeCommand('mfcode.preview');
}

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('mfcode.compile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor');
            return;
        }
        
        var terminal = vscode.window.terminals.find((terminal) => terminal.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
        }

        terminal.sendText(`cd "${path.dirname(editor.document.fileName)}"`);
        terminal.sendText(`mf --halt-on-error ${editor.document.fileName}`);
        terminal.sendText('end.');
        // terminal.show();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mfcode.preview', () => {
        preview(context);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mfcode.compileAndPreview', () => {
        compileAndPreview();
    }));
}

function getWebviewContent(images) {
    return `
      <html>
      <body>
        ${images.map(base64Image => `<img src="data:image/png;base64,${base64Image}" alt="Image">`).join('\n')}
      </body>
      </html>
    `;
  }

exports.activate = activate;
