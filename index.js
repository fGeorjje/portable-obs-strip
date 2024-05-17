const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
function getDir() {
  if (process.argv[2]) return process.argv.slice(2).join(' ')
  // https://stackoverflow.com/a/51658369
  let psScript = `
  Function Select-FolderDialog
  {
      param([string]$Description="Select Folder",[string]$RootFolder="Desktop")

   [System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms") |
       Out-Null     

     $objForm = New-Object System.Windows.Forms.FolderBrowserDialog
          $objForm.Rootfolder = $RootFolder
          $objForm.Description = $Description
          $Show = $objForm.ShowDialog()
          If ($Show -eq "OK")
          {
              Return $objForm.SelectedPath
          }
          Else
          {
              Write-Error "Operation cancelled by user."
          }
      }

  $folder = Select-FolderDialog # the variable contains user folder selection
  write-host $folder
  `
  const { stdout } = spawnSync('powershell.exe', [psScript])
  return stdout.toString().replaceAll('\n', '')
}
const dir = getDir()
const topLevelFiles = new Set(fs.readdirSync(dir))
const expectedTopLevelFiles = ['obs-plugins', 'data', 'bin']
const validOBS = expectedTopLevelFiles.every(s => topLevelFiles.has(s))
if (!validOBS) {
  console.log('Select a valid OBS folder path containing', expectedTopLevelFiles.join(', '))
  process.exit(-1)
}

const files = fs.readdirSync(dir, { 
  recursive: true,
  withFileTypes: true
})

function allOfTypeExcept(...exclude) {
  const type = exclude[0].split('.').pop()
  return (file) => {
    if (!file.name.endsWith(type)) return false
    return exclude.every(e => file.name !== e)
  }
}

const deletePlugins = [
  'aja', 'aja-output-ui', 'decklink', 'decklink-captions', 'decklink-output-ui',
  'frontend-tools', 'text-freetype2', 'vlc-video', 
]
function handle_plugins(file) {
  return deletePlugins.some(p => file.name === `${p}.dll`)
}

const deleteThemes = [
  'Acri', 'Dark', 'Grey', 'Light', 'Rachni', 'System'
]
function handle_themes(file) {
  return deleteThemes.some(t => file.name === `${t}.qss`)
}

const deletePaths = [
  'plugin_config/obs-browser',
  'config/obs-studio/profiler_data',
  'config/obs-studio/logs',
  'config/obs-studio/crashes',
  ...deleteThemes.map(t => `data/obs-studio/themes/${t}`),
  ...deletePlugins.map(p => `data/obs-plugins/${p}`)
]

function handler_paths(file) {
  return deletePaths.some(deletePath => {
    return deletePath.split('/').every(p => file.path.includes(p))
  })
}

const handlers = [
  allOfTypeExcept('.pdb'),
  allOfTypeExcept('en-US.pak', 'resources.pak', 'chrome_100_percent.pak', 'chrome_200_percent.pak'),
  allOfTypeExcept('global.ini', 'locale.ini', 'basic.ini', 'en-US.ini'),
  handle_plugins,
  handler_paths
]

let total = files.length
const toRemove = files.filter(file => {
  if (!file.isFile()) return false
  return handlers.some(h => h(file))
})

if (toRemove.length > 5000) {
  console.error('Failsafe triggered, this script should not be deleting more than 5000 files.')
  process.exit(-1)
}

toRemove.forEach(file => {
  const fullPath = path.join(file.path, file.name)
  console.log('Removing', fullPath)
  fs.unlinkSync(fullPath)
})
console.log('Removed', toRemove.length, 'out of', total, 'files')