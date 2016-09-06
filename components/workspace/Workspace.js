import React, { Component } from 'react'
import pureRender from 'pure-render-decorator'

import Header from './Header'
import Editor from './Editor'
import PlayerFrame from './PlayerFrame'
import Status from './Status'
import Overlay from './Overlay'
import Button from './Button'
import About from './About'
import { getErrorDetails } from '../../utils/ErrorMessage'
import { prefixObject } from '../../utils/PrefixInlineStyles'

const BabelWorker = require("worker!../../babel-worker.js")
const babelWorker = new BabelWorker()

const styles = prefixObject({
  container: {
    flex: '1',
    display: 'flex',
    alignItems: 'stretch',
    minWidth: 0,
    minHeight: 0,
  },
  left: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 0,
    minHeight: 0,
  },
  edleft: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 0,
    minHeight: 0,
    position: 'relative'
  },
  right: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    marginLeft: 10,
    marginRight: 10,
  },
  overlayContainer: {
    position: 'relative',
    flex: 0,
    height: 0,
    alignItems: 'stretch',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    background: 'rgba(255,255,255,0.95)',
    zIndex: 100,
    left: 4,
    right: 0,
    borderTop: '1px solid #F8F8F8',
    display: 'flex',
    alignItems: 'stretch',
  },
  section: {
    display: 'inline-block',
    borderRadius: 0,
    height: '30px',
    width: '120px',
    lineHeight: '30px',
    textAlign: 'center',
    border: '1px solid black',
    cursor: 'pointer',
    marginLeft: '5px',
    marginRight: '5px',
    position: 'relative'
  }
})

@pureRender
class Workspace extends Component {

  static defaultProps = {
    value: '',
    title: 'Live Editor',
    onChange: () => {},
    platform: null,
    scale: null,
    width: null,
    assetRoot: null,
    vendorComponents: [],
    codeSplitEnabled: null,
    codePreprocessEnabled: null,
  }

  constructor(props) {
    super(props)
    this.state = {
      compilerError: null,
      runtimeError: null,
      showDetails: false,
      selectedSection: 0,
      sections: { default: '' },
      lineCounts: { default: 0 },
      cursorPos: null,
      selectionPos: null,
    }
    this.onCodeChange = this.onCodeChange.bind(this)
    this.onCursor = this.onCursor.bind(this)
    this.onToggleDetails = this.onToggleDetails.bind(this)
    this.onPlayerRun = this.onPlayerRun.bind(this)
    this.onPlayerError = this.onPlayerError.bind(this)
    this.onPlayerSuccess = this.onPlayerSuccess.bind(this)
    this.onBabelWorkerMessage = this.onBabelWorkerMessage.bind(this)
    this.onWindowMessage = this.onWindowMessage.bind(this)
    this.postParentCode = () => {}
    this.timeout = undefined
    babelWorker.addEventListener("message", this.onBabelWorkerMessage)
    window.addEventListener("message", this.onWindowMessage)

    if (props.codeSplitEnabled) {
      try {
        var sections = typeof props.value === 'object' ? props.value : JSON.parse(props.value)
        this.state.sections = sections
        this.state.lineCounts = this.calculateLineCounts(sections)
      } catch (e) {
        console.log(e)
        this.state.sections = { 'default' : props.value }
      }
    }
  }

  calculateLineCounts(sections) {
    var keys = Object.keys(sections)
    var counts = {}
    for (var i = 0; i < keys.length; ++i) {
      var key = keys[i]
      // We append a line break to each section, so up the counts by 1
      counts[key] = (sections[key].match(/\n/g) || []).length + 1;
    }
    return counts
  }

  onCursor(pos, selectionPos) {
    this.setState( { cursorPos: pos, selectionPos: selectionPos })
  }

  componentWillUnmount() {
    babelWorker.removeEventListener("message", this.onBabelWorkerMessage)
  }

  getCode() {
      const {value} = this.props
      const code = Object.keys(this.state.sections).reduce((prev, curr) => {
        return prev + this.state.sections[curr] + '\n'
      }, '')
      return code
  }

  componentDidMount() {
    if (typeof navigator !== 'undefined') {
      const value = this.getCode()
      if (this.props.codePreprocessEnabled && parent) {
        this.handlePreprocess(value)
      } else {
        this.handleCodeChange(value)
      }
    }
  }

  runApplication(value) {
    this.refs.player.runApplication(value)
  }

  onBabelWorkerMessage({data}) {
    this.onCompile(JSON.parse(data))
  }

  onWindowMessage({data}) {
    if (data.type === 'codepreprocessed' && data.code) {
      this.handleCodeChange(data.code)
    } else if (data.type === 'errorpreprocessed' && data.error) {
      var errorState = {}
      errorState[data.component] = this.onProcessErrorDetails(data.error)
      this.setState(errorState)
    } 
  }

  onProcessErrorDetails(error) {
    const keys = Object.keys(this.state.sections)

    // If we have multiple keys, our line numbers will be off
    if (keys.length > 0) {
      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i]
        if (error.lineNumber > this.state.lineCounts[key]) {
          error.lineNumber = error.lineNumber - this.state.lineCounts[key]
        } else {
          // error is in this section
          error.section = key
          break
        }
      }
    }

    return error
  }

  onCompile(data) {
    switch (data.type) {
      case 'code':
        this.setState({
          compilerError: null,
          showDetails: false,
        })

        const {code} = data

        if (code) {
          this.runApplication(code)
        }
      break
      case 'error':
        const {error} = data
        var errorDetails = getErrorDetails(error.message)

        if (this.props.codePreprocessEnabled && parent) {
          parent.postMessage({ type: 'errorpreprocess', error: errorDetails, component: 'compilerError' }, '*')
        } else {
          this.setState({compilerError: this.onProcessErrorDetails(errorDetails)})
        }
      break
    }
  }

  onCodeChange(value) {
    var keys = Object.keys(this.state.sections)
    var selectedSection = this.state.selectedSection
    var selectedSectionKey = keys[this.state.selectedSection]

    var sections = Object.assign({}, this.state.sections, { [selectedSectionKey] : value })
    var lineCounts = this.calculateLineCounts(sections)
    this.setState({ sections, lineCounts })
    this.processCodeChange()
  }

  processCodeChange(sect) {
    var sections = this.state.sections
    var value = this.getCode()
    // Use timeouts for code-change to prevent churn
    if (this.timeout) { clearTimeout(this.timeout) }
    this.timeout = setTimeout(() => {
      this.timeout = undefined
      this.postParentCode = (message) => parent.postMessage({ type: 'codechange', sections: sections, code: value, compiled: message }, '*')

      if (this.props.codePreprocessEnabled && parent) {
        this.handlePreprocess(value)
      } else {
        this.handleCodeChange(value)
      }
    }, 250)
  }

  handlePreprocess(value) {
    parent.postMessage({ type: 'codepreprocess', code: value }, '*')
  }

  handleCodeChange(value) {
    babelWorker.postMessage(value)
    this.props.onChange(value)
  }

  onToggleDetails(showDetails) {
    this.setState({showDetails})
  }

  onPlayerRun() {
    this.setState({runtimeError: null})
  }

  onPlayerError(message) {
    var errorDetails = getErrorDetails(message)

    if (this.props.codePreprocessEnabled && parent) {
      parent.postMessage({ type: 'errorpreprocess', error: errorDetails, component: 'runtimeError' }, '*')
    } else {
      this.setState({runtimeError: this.onProcessErrorDetails(errorDetails)})
    }
  }

  onPlayerSuccess(message) {
      // Send a message to the parent
      this.postParentCode(message)
  }

  onMoveSectionLeft(sectionIndex, ev) {
    ev.stopPropagation()

    if (sectionIndex > 0) {
      var keys = Object.keys(this.state.sections)
      var key = keys[sectionIndex]
      var val = this.state.sections[key]
      console.log(this.state.sections)
      var sections = {}
      for (var i = 0; i < keys.length; ++i) {
        if (sectionIndex-1 === i) {
          sections[keys[sectionIndex]] = val
          sections[keys[i]] = this.state.sections[keys[i]]
          i++
        } else {
          sections[keys[i]] = this.state.sections[keys[i]]
        }
        console.log(sections)
      }
      console.log(sections)

      var lineCounts = this.calculateLineCounts(sections)
      this.setState({ sections: sections, lineCounts }, () => this.processCodeChange())
    }
  }

  onMoveSectionRight(sectionIndex, ev) {
    ev.stopPropagation()

    var keys = Object.keys(this.state.sections)

    if (sectionIndex < keys.length - 1) {
      var key = keys[sectionIndex]
      var val = this.state.sections[key]
      var sections = {}
      for (var i = 0; i < keys.length; ++i) {
        if (sectionIndex === i) {
          sections[keys[i+1]] = this.state.sections[keys[i+1]]
          sections[key] = val
          i++
        } else {
          sections[keys[i]] = this.state.sections[keys[i]]
        }
      }

      var lineCounts = this.calculateLineCounts(sections)
      this.setState({ sections: sections }, () => this.processCodeChange())
    }
  }

  render() {
    const {value, title, platform, scale, width, assetRoot, vendorComponents} = this.props
    const {compilerError, runtimeError, showDetails} = this.state

    const error = compilerError || runtimeError
    const isError = !! error

    const sections = this.state.sections//{ '1. Data' : '//1\n' + value, '2. Code' : '//2\n' + value, '3. Style' : '//3\n' + value }
    var keys = Object.keys(sections)
    var selectedSection = this.state.selectedSection
    var selectedSectionKey = keys[this.state.selectedSection]
    var code = sections[selectedSectionKey]
    var multiSection = keys.length > 1

    return (
      <div style={styles.container}>
        <div style={styles.left}>
          {title && (
            <Header
              text={title}
            />
          )}
          { multiSection &&
          <div>
            {Object.keys(sections).map((s, idx) => {
              var className = "sectionButton"
              if (idx === selectedSection) {
                className += " selected"
              }
              
              if (isError && error.section === s) {
                className += " error"
              }
              return (
                <div className={className} key={s} onClick={() => this.setState({ selectedSection: idx }) }>
                  <span className="sectionLeft" onClick={this.onMoveSectionLeft.bind(this, idx)}>◀︎</span>
                  <span>{s}</span>
                  <span className="sectionRight" onClick={this.onMoveSectionRight.bind(this, idx)}>▶</span>
                </div>
              )
            })}
          </div>
          }
          <div style={styles.edleft}>
            { multiSection &&
              <Header
                text={selectedSectionKey}
              />
            }
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {Object.keys(sections).map((s, idx) => {
              const style = { visibility: idx === selectedSection ? 'visible' : 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
              return (
                <div style={style} key={s}>
                  <Editor
                    value={sections[s]}
                    onChange={this.onCodeChange}
                    onCursor={this.onCursor}
                    errorLineNumber={(isError && error.section === s) && (error.lineNumber)}
                  />
                </div>)
            })}
            </div>
          </div>
          {showDetails && (
            <div style={styles.overlayContainer}>
              <div style={styles.overlay}>
                <Overlay isError={isError}>
                  {isError ? error.description + '\n\n' : ''}
                  <About />
                </Overlay>
              </div>
            </div>
          )}
          <Status
            text={isError ? error.summary : 'No Errors'}
            isError={isError}
          >
            <Button
              active={showDetails}
              isError={isError}
              onChange={this.onToggleDetails}
            >
              {'Show Details'}
            </Button>
          </Status>
        </div>
        <div style={styles.right}>
          <PlayerFrame
            ref={'player'}
            width={width}
            scale={scale}
            platform={platform}
            assetRoot={assetRoot}
            vendorComponents={vendorComponents}
            onRun={this.onPlayerRun}
            onError={this.onPlayerError}
            onSuccess={this.onPlayerSuccess}
          />
        </div>
      </div>
    )
  }
}

// Workspace.prototype.shouldComponentUpdate = function(nextProps, nextState) {
//   if (this.shouldSkip) {
//     this.shouldSkip = false
//     return false
//   }
//   return true
// }

export default Workspace