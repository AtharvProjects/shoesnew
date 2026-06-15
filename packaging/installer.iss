; ====================================================
; Gajraj Kirana Billing Software — Inno Setup Script
; ====================================================
; This script creates a professional Windows installer.
;
; Prerequisites:
;   1. Run `node packaging/build.js` first to create dist/GajrajKirana/
;   2. Install Inno Setup 6: https://jrsoftware.org/isinfo.php
;   3. Compile this script with Inno Setup Compiler
;
; The installer will:
;   - Install to Program Files
;   - Create Start Menu and Desktop shortcuts
;   - Optionally add auto-start on Windows boot
;   - Clean uninstall with option to keep user data
; ====================================================

#define MyAppName "Gajraj Kirana Billing"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Gajraj Kirana Stores"
#define MyAppURL "https://github.com/abhayr18/Gajraj_Billing_Software"
#define MyAppExeName "GajrajKirana.vbs"

[Setup]
; Unique application ID — DO NOT change this for updates
AppId={{A7E3F2D1-4B8C-4D2E-9F1A-6C3D5E8B7A90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}

; Install location
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes

; Output
OutputDir=..\dist
OutputBaseFilename=GajrajKirana_Setup_v{#MyAppVersion}
SetupIconFile=..\public\favicon.ico
UninstallDisplayIcon={app}\public\favicon.ico

; Compression
Compression=lzma2/ultra64
SolidCompression=yes

; Privileges
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Appearance
WizardStyle=modern
WizardSizePercent=110

; Minimum Windows version (Windows 10)
MinVersion=10.0

; Prompt for License Key
UserInfoPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Start automatically when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
; Everything from the dist/GajrajKirana folder
Source: "..\dist\GajrajKirana\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu shortcut
Name: "{autoprograms}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\public\favicon.ico"; Comment: "Launch Gajraj Kirana Billing Software"

; Desktop shortcut (optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\public\favicon.ico"; Tasks: desktopicon; Comment: "Launch Gajraj Kirana Billing Software"

[Registry]
; Auto-start on Windows boot (optional task)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GajrajKirana"; ValueData: """wscript.exe"" ""{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Launch the app after installation
Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent; WorkingDir: "{app}"

[UninstallRun]
; Kill any running node.exe processes from our app directory before uninstall
Filename: "{cmd}"; Parameters: "/c taskkill /F /IM node.exe /FI ""MODULES eq {app}\node.exe"" 2>nul"; Flags: runhidden

[UninstallDelete]
; Clean up the app installation directory
Type: filesandordirs; Name: "{app}"

[Code]
#ifdef UNICODE
  #define AW "W"
#else
  #define AW "A"
#endif

function GetVolumeInformation(
  lpRootPathName: String;
  lpVolumeNameBuffer: String;
  nVolumeNameSize: DWORD;
  var lpVolumeSerialNumber: DWORD;
  var lpMaximumComponentLength: DWORD;
  var lpFileSystemFlags: DWORD;
  lpFileSystemNameBuffer: String;
  nFileSystemNameSize: DWORD
): BOOL; external 'GetVolumeInformation{#AW}@kernel32.dll stdcall';

function GetMachineID(): String;
var
  Serial: DWORD;
  Dummy1, Dummy2: DWORD;
begin
  if GetVolumeInformation('C:\', '', 0, Serial, Dummy1, Dummy2, '', 0) then
    Result := Format('%.8X', [Serial])
  else
    Result := 'UNKNOWN0';
end;

function CalculateChecksum(MachineID: String): String;
var
  i: Integer;
  sum: Integer;
begin
  sum := 0;
  for i := 1 to Length(MachineID) do
    sum := sum + Ord(MachineID[i]);
  
  // Basic scrambling to avoid obvious checksums
  sum := (sum * 9973) mod 65536; 
  Result := Format('%.4X', [sum]);
end;

// Initialize Wizard to show Machine ID in UserInfoPage
procedure InitializeWizard();
begin
  WizardForm.UserInfoSerialLabel.Caption := 'License Key (Your Machine ID is: ' + GetMachineID() + ')';
end;

// Validate the Serial Number entered in the UserInfoPage
function CheckSerial(Serial: String): Boolean;
var
  MachineIDInKey, ExpectedChecksum, ActualChecksum: String;
begin
  Result := False;
  // Format: GKS-XXXX-XXXX-XXXX (18 chars)
  if Length(Serial) <> 18 then Exit;
  if Copy(Serial, 1, 4) <> 'GKS-' then Exit;
  if Serial[9] <> '-' then Exit;
  if Serial[14] <> '-' then Exit;
  
  MachineIDInKey := Copy(Serial, 5, 4) + Copy(Serial, 10, 4);
  ActualChecksum := Copy(Serial, 15, 4);
  ExpectedChecksum := CalculateChecksum(MachineIDInKey);
  
  // 1. Validate mathematically
  if ActualChecksum <> ExpectedChecksum then Exit;
  
  // 2. Validate against physical machine
  if MachineIDInKey <> GetMachineID() then Exit;
  
  Result := True;
end;

// Save the valid serial to a .license file after install
procedure CurStepChanged(CurStep: TSetupStep);
var
  LicenseKey: String;
  LicenseFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    LicenseKey := ExpandConstant('{userinfoserial}');
    if LicenseKey <> '' then
    begin
      ForceDirectories(ExpandConstant('{app}\data'));
      LicenseFile := ExpandConstant('{app}\data\.license');
      SaveStringToFile(LicenseFile, LicenseKey, False);
    end;
  end;
end;

// Custom uninstall code to ask about keeping user data
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\GajrajKirana');
    if DirExists(DataDir) then
    begin
      if MsgBox(
        'Do you want to KEEP your business data (invoices, customers, products)?' + #13#10 + #13#10 +
        'Click YES to keep your data (recommended if you plan to reinstall).' + #13#10 +
        'Click NO to delete everything permanently.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDNO then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
