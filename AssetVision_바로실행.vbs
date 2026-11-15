Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 백그라운드(창 숨김 모드)로 개발 서버 구동 후 브라우저 오픈
WshShell.Run "cmd /c npm run dev", 0, False
WScript.Sleep 1200
WshShell.Run "http://localhost:5173", 1, False
