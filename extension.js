const vscode = require('vscode');

const acornLoose = require("acorn-loose"); // js parser
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let disposable = vscode.commands.registerCommand('extension.findAllImports', function () {
		// list all files in a folder / skip node_modules etc.
		const walkSync = (dir, filelist = []) => {
			fs.readdirSync(dir).forEach(file => {
				function wantToWalk(file) {
					return ! ['node_modules', 'bower_components', '.git'].includes(file)
				}
				filelist = (fs.statSync(path.join(dir, file)).isDirectory() && wantToWalk(file))
					? walkSync(path.join(dir, file), filelist)
					: filelist.concat(path.join(dir, file));
			});
			return filelist;
		}
		// resolve import path into absolute path
		function getAbsPath(importPath, startingPath){
			if (importPath.length) {
				let path = importPath.split('/');
				let retPath = startingPath.split('\\');
				retPath.pop();
				for (let part of path){
					if (part.trim()) {
						if (part === '.') {
							// do nothing
						} else if (part === '..') {
							retPath.pop();
						} else {
							retPath.push(part);
						}
					}
				}
				return retPath.join('\\');
			} else {
				return importPath;
			}
		}

		function appendDotJs(filename) {
			return filename.toLowerCase().endsWith('.js') ? filename : filename + '.js';
		}

		let currentlyOpenTabfilePath = vscode.window.activeTextEditor.document.fileName;
		let workspaceFolders = vscode.workspace.workspaceFolders;
		
		// if at least 1 project folder is open and there is 1 active js file in the editor
		if (workspaceFolders && workspaceFolders.length && 
			currentlyOpenTabfilePath && 
			currentlyOpenTabfilePath.toLowerCase().endsWith('.js')) {

			// find all js files within current projects
			let workspaceFolderPaths = workspaceFolders.map(folder => folder.uri.fsPath);
			let jsFiles = [];
			for (const path of workspaceFolderPaths) {
				jsFiles = jsFiles.concat(walkSync(path).filter(f => f.toLowerCase().endsWith('.js')))
			}

			// find all files that import current file
			let filesThatImportCurrentFile = [];
			for (const fileName of jsFiles) {
				let parsed = acornLoose.parse(fs.readFileSync(fileName, 'utf8'));
				for (const item of parsed.body){
					if (item.type === "ImportDeclaration") {
						let importPath = item.source.value;
						// check if local path
						if (importPath.startsWith('.')) {
							// transform it to absolute path
							let absPath = getAbsPath(importPath, fileName);
							if (appendDotJs(absPath).toLowerCase() === currentlyOpenTabfilePath.toLowerCase()) {
								filesThatImportCurrentFile.push(fileName);
							}
						}
					}
				}
			}
			
			if (filesThatImportCurrentFile.length) {
				// display file list
				vscode.window.showQuickPick(filesThatImportCurrentFile.map((fn, index) => ({
					id: index,
					label: fn.split('\\').pop(),
					description: fn
					//detail: 'aaaaaaaaaaaa'
				}))).then(item => {
					vscode.workspace.openTextDocument(item.description).then(document => {
						vscode.window.showTextDocument(document, {preview: false});
					});
				});
			} else {
				// show 'no files found'
				vscode.window.showQuickPick([{
					label: 'No files found.'
				}]).then(item => {
					// do nothing
				});
			}

			
		}
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
