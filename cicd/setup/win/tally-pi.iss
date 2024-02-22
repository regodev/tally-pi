
#define ServiceName="TallyPI"

[Setup]
AppName=Rego Tally PI
AppId={{AAAE3347-CB28-4138-A4F8-49F1225559BD}}
AppVersion={#Version}
VersionInfoVersion={#Version}
AppPublisher=Stinky Computing
UsePreviousAppDir=yes
DisableDirPage=yes
DefaultDirName={commonpf}\Rego\TallyPI
DefaultGroupName=Rego
SetupIconFile=tally-pi.ico
LicenseFile=license.rtf
Uninstallable=yes
UninstallDisplayIcon={app}\unins000.exe
ArchitecturesInstallIn64BitMode=x64
OutputBaseFilename=TallyPI {#Version}
SetupLogging=yes

[Files]
Source: "..\..\build\*"; DestDir: "{app}"; Flags: replacesameversion recursesubdirs
Source: "ServiceExe.exe"; DestDir: "{app}"
Source: "TallyPI.ini"; DestDir: "{app}"
Source: "node.exe"; DestDir: "{app}"

[Dirs]
Name: "{app}\logs"

[Registry]
Root: HKLM; Subkey: "Software\Rego\TallyPI\"; ValueType: string; ValueName: "Version"; ValueData: {#Version}; Flags: uninsdeletekey

[Run]

[UninstallRun]
Filename: {sys}\sc.exe; Parameters: "delete {#ServiceName}"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\*.log"

[Code]
procedure StopServices;
var
  ResultCode: Integer;
begin
  if Exec('sc.exe', ExpandConstant('stop {#ServiceName}'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('Stopped Elmo Service');
  end else
    Log('Failed to stop Elmo service, code: ' + IntToStr(ResultCode));
end;

function PrepareToInstall(var NeedsRestart: Boolean): string;
begin
  StopServices();
  Result := '';
end;

function InitializeUninstall(): Boolean;
begin
  StopServices();
  Result := True;
end;


/////////////////////////////////////////////////////////////////////
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if (CurStep = ssPostInstall) then
  begin
      Exec(ExpandConstant('{app}\ServiceExe.exe'), '-install TallyPI.ini /A', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('sc', ExpandConstant('failure {#ServiceName} reset= 60 actions= restart/60000/restart/60000/restart/60000'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('sc', ExpandConstant('start {#ServiceName}'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
