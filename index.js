const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const prompts = require('prompts')
const lastFolderFileName = 'last.txt'

main().catch((error) => {
  console.error(error)
  setTimeout(() => {
  }, 10000)
})

async function main() {
  const folder = await promptFolder()
  await checkIfOBSFolder(folder)
  fs.promises.writeFile(lastFolderFileName, folder, 'utf-8')

  const files = await fs.promises.readdir(folder, { 
    recursive: true,
    withFileTypes: true
  })

  const plugins = [
    'aja', 'aja-output-ui', 'decklink', 'decklink-captions', 'decklink-output-ui',
    'frontend-tools', 'text-freetype2', 'vlc-video', 
  ]

  const handlers = [
    allOfType('.pdb'),
    allOfType('.pak').except('en-US', 'resources', 'chrome_100_percent', 'chrome_200_percent'),
    allOfType('.ini').except('en-US', 'global', 'locale', 'basic'),
    someOfType('.dll', ...plugins),
    someOfType('.ovt', 'Yami_Acri', 'Yami_Grey', 'Yami_Light', 'Yami_Rachni'),
    someOfType('.obt', 'System'),
    allOnPath('plugin_config/obs-browser'),
    allOnPath('config/obs-studio/profiler_data'),
    allOnPath('config/obs-studio/logs'),
    allOnPath('config/obs-studio/crashes'),
    allOnPath(...['Acri', 'Light', 'Rachni'].map(t => `data/obs-studio/themes/${t}`)),
    allOnPath(...plugins.map(p => `data/obs-plugins/${p}`))
  ]

  let total = files.length
  const toRemove = files.filter(file => {
    if (!file.isFile()) return false
    return handlers.some(h => h(file))
  })

  if (toRemove.length > 5000) {
    throw new Error('This script should not be deleting more than 5000 files.')
  }

  toRemove.forEach(file => {
    const fullPath = path.join(file.path, file.name)
    return fs.unlinkSync(fullPath)
    console.log('Removed', fullPath)
  })
  console.log('Removed', toRemove.length, 'out of', total, 'files')
}

async function promptFolder() {
  if (process.argv[2]) return process.argv.slice(2).join(' ')
  const choices = await createPromptChoices()
  
  const { handler } = await prompts({
    type: 'select',
    name: 'handler',
    message: 'Select OBS folder',
    choices
  })
  
  return await handler()
}

async function createPromptChoices() {
  const choices = []
  try {
    const lastDir = await fs.promises.readFile(lastFolderFileName, 'utf-8')
    choices.push({
      title: `Use last: ${lastDir}`,
      value: async () => {
        return lastDir
      }
    })
  } catch (error) {
    console.log('No last directory found')
  }
  choices.push({
    title: 'Choose from system',
    value: async () => {
      return await selectFolderFromSystem()
    }
  })
  return choices
}

async function checkIfOBSFolder(folder) {
  const topLevelFiles = await fs.promises.readdir(folder)
  const topLevelFilesSet = new Set(topLevelFiles)
  const expectedTopLevelFiles = ['obs-plugins', 'data', 'bin']
  const validOBS = expectedTopLevelFiles.every(s => topLevelFilesSet.has(s))
  if (!validOBS) {
    throw new Error('Select a valid OBS folder path containing', expectedTopLevelFiles.join(', '))
  }
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    runCommand0(command, args, options, resolve, reject)
  })
}
  
function runCommand0(command, args, options, resolve, reject) {
  const process = spawn(command, args, options)
  const stdoutArray = setupBuffer(process.stdout)
  const stderrArray = setupBuffer(process.stderr)
  process.on('close', () => {
    const stdout = stdoutArray.join('')
    const stderr = stderrArray.join('')
    resolve({ stdout, stderr })
  })
  process.on('error', (error) => { 
    reject(error)
  })
}

function setupBuffer(stream) {
  const buffer = []
  stream.on('data', (data) => {
    const str = data.toString()
    console.log(str)
    buffer.push(str)
  })
  return buffer
}

async function selectFolderFromSystem() {
  // https://stackoverflow.com/a/51658369
  const command = `Function Select-FolderDialog
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
  const { stdout, stderr } = await runCommand('powershell.exe', [command])
  return stdout.toString().replaceAll('\n', '')
}

function someOfType(type, ...args) {
  return (file) => {
    const nameWithoutExtension = file.name.split('.').at(-2)
    return file.name.endsWith(type) && args.some(arg => nameWithoutExtension === arg)
  }
}

function allOfType(type) {
  const handler = (file) => {
    return file.name.endsWith(type)
  }
  handler.except = (...args) => {
    return (file) => {
      const nameWithoutExtension = file.name.split('.').at(-2)
      //console.log(file, nameWithoutExtension, ...args)
      return handler(file) && args.every(arg => nameWithoutExtension !== arg)
    }
  }
  return handler
}

function allOnPath(...deletePaths) {
  return (file) => {
    return deletePaths.some(deletePath => {
      return deletePath.split('/').every(p => file.path.includes(p))
    })
  }
}