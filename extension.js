const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { config } = require('process');

const terminalName = "mfcode";

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let previewPanel;

async function preview(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active text editor');
        return;
    }

    var terminal = vscode.window.terminals.find((terminal) => terminal.name === terminalName);
    if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
    }

    const configuration = vscode.workspace.getConfiguration('mfcode');

    terminal.sendText(`cd "${path.dirname(editor.document.fileName)}"`);
    var baseName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
    terminal.sendText(`gftodvi "${baseName}"*gf`)
    terminal.sendText(`dvipdf "${baseName}".dvi`);
    terminal.sendText(`pdftoppm "${baseName}".pdf "${baseName}" -png`);
    terminal.sendText(`rm "${baseName}".pdf`);
    terminal.sendText(`for file in "${baseName}"*.png; do convert "$file" -trim "$file"; done`);
    if (configuration.get('showTerminals', false)) {
        terminal.show();
    }

    await delay(configuration.get('delay', 1000));

    if (!previewPanel) {
        previewPanel = vscode.window.createWebviewPanel(
            'metafontPreview',
            'METAFONT Preview',
            vscode.ViewColumn.Two,
            {}
        );

        previewPanel.onDidDispose(
            () => {
                previewPanel = null;
            },
            null,
            context.subscriptions
        )
    } else {
        previewPanel.reveal(vscode.ViewColumn.Two);
    }

    // Find all matching PNG files
    const matchingFiles = fs.readdirSync(path.dirname(editor.document.fileName))
        .filter(file => file.startsWith(`${baseName}-`) && file.endsWith('.png'));

    // Read and convert each matching file to base64
    const base64Images = matchingFiles.map(file => {
        const filePath = path.join(path.dirname(editor.document.fileName), file);
        return fs.readFileSync(filePath, 'base64');
    });

    previewPanel.webview.html = getWebviewContent(base64Images);
}

async function compileAndPreview() {
    vscode.commands.executeCommand('mfcode.compile');
    vscode.commands.executeCommand('mfcode.preview');
}

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('mfcode.compile', () => {
        const configuration = vscode.workspace.getConfiguration('mfcode');

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
        terminal.sendText(`${configuration.get('mfCmd', 'mf')} ${configuration.get('mfOptions', '')} ${editor.document.fileName}`);
        // if (configuration.get('modeSetup', '').length > 0) {
        //     terminal.sendText(`${configuration.get('modeSetup', '')}; input `);
        // }
        // terminal.sendText(editor.document.fileName);
        if (configuration.get('endOnFinish', false)) {
            terminal.sendText('end.');
        } else if (configuration.get('showTerminals', false)) {
            terminal.show();
        }
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
