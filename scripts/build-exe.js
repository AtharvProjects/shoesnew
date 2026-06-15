const path = require('path');
const innosetupCompiler = require('innosetup-compiler');

const issPath = path.resolve(__dirname, '../packaging/installer.iss');

console.log('Building Inno Setup installer from:', issPath);

innosetupCompiler(issPath, { gui: false, verbose: true }, function(error) {
    if (error) {
        console.error('Failed to compile installer:', error);
        process.exit(1);
    }
    console.log('Successfully compiled the installer!');
});
