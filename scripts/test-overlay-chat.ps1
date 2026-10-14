param([string]$NewtonsoftPath = '')
$ErrorActionPreference = 'Stop'
if (-not $NewtonsoftPath) {
    $NewtonsoftPath = [Newtonsoft.Json.Linq.JObject].Assembly.Location
}
$root = Split-Path $PSScriptRoot -Parent
$source = [IO.File]::ReadAllText((Join-Path $root 'streamerbot/overlay-chat-announcements.cs'))
# Inject only the Streamer.bot host and HTTP transport; execute the production logic.
$source = $source.Replace('public class CPHInline', 'public partial class CPHInline')
$source = $source.Replace('private static readonly HttpClient Http', 'public static HttpClient Http')
$fixture = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'tests/overlay-chat-harness.cs'))
$references = @(Get-ChildItem -LiteralPath (Join-Path $PSHOME 'ref') -Filter '*.dll' | ForEach-Object FullName) + $NewtonsoftPath
Add-Type -TypeDefinition ($source + [Environment]::NewLine + $fixture) -ReferencedAssemblies $references -CompilerOptions '/nowarn:1701'
[OverlayChatTests]::Run()
