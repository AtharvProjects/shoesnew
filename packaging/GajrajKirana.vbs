' GajrajKirana.vbs — Silent Launcher (no console window)
' This script launches the Node.js server without showing a terminal window.
' It is compiled or used alongside the .exe shortcut.

Dim WshShell, fso, appDir, nodeExe, launcherScript

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script lives
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Paths
nodeExe = fso.BuildPath(appDir, "node.exe")
launcherScript = fso.BuildPath(appDir, "launcher.js")

' Verify files exist
If Not fso.FileExists(nodeExe) Then
    MsgBox "Error: node.exe not found in " & appDir, vbCritical, "Gajraj Kirana"
    WScript.Quit 1
End If

If Not fso.FileExists(launcherScript) Then
    MsgBox "Error: launcher.js not found in " & appDir, vbCritical, "Gajraj Kirana"
    WScript.Quit 1
End If

' Launch node.exe with launcher.js — 0 = hidden window, False = don't wait
WshShell.Run """" & nodeExe & """ """ & launcherScript & """", 0, False
