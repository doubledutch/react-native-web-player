import React, { Component } from 'react'
import pureRender from 'pure-render-decorator'

import { options, requireAddons } from '../../utils/CodeMirror'
import { prefixObject } from '../../utils/PrefixInlineStyles'

const codemirror = require('codemirror')

require("../../node_modules/codemirror/lib/codemirror.css")
require("../../styles/codemirror-theme.css")

// Work around a codemirror + flexbox + chrome issue by creating an absolute
// positioned parent and flex grandparent of the codemirror element.
// https://github.com/jlongster/debugger.html/issues/63
const styles = prefixObject({
  editorContainer: {
    display: 'flex',
    flex: '1',
    minWidth: 0,
    minHeight: 0,
  },
  editor: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
})

@pureRender
export default class extends Component {

  static defaultProps = {
    value: '',
    onChange: () => {},
  }

  constructor() {
    super()
    this.state = {}
  }

  componentDidMount() {
    if (typeof navigator !== 'undefined') {
      requireAddons()

      const {value, onChange, onCursor} = this.props

      this.cm = codemirror(
        this.refs.editor,
        {
          ...options,
          value,
        }
      )

      this.cm.on('changes', (cm) => {
        onChange(cm.getValue())
      })
      this.cm.on('cursorActivity', (cm) => {
        onCursor(cm.getCursor(), cm.getSelection())
      })
    }
  }

  componentWillUpdate(nextProps) {
    const {errorLineNumber: nextLineNumber, value: nextCode, cursorPos: nextCursor, selectionPos: nextSelection} = nextProps
    const {errorLineNumber: prevLineNumber, value: prevCode, cursorPos: prevCursor} = this.props

    if (this.cm) {
      if (typeof prevLineNumber === 'number') {
        this.cm.removeLineClass(prevLineNumber, "background", "cm-line-error")
      }

      if (typeof nextLineNumber === 'number') {
        this.cm.addLineClass(nextLineNumber, "background", "cm-line-error")
      }

      if (nextCode !== prevCode) {
        //this.cm.setValue(nextCode)
      }

      // if (nextCursor && nextSelection) {
      //   this.cm.setCursor(nextCursor)
      //   this.cm.setSelection(nextSelection)
      // }
    }
  }

  componentDidUpdate() {
    const {errorLineNumber: nextLineNumber, value: nextCode, cursorPos: nextCursor, selectionPos: nextSelection} = this.props
    if (this.cm) {
      if (nextCursor && nextSelection) {
        this.cm.setCursor(nextCursor)
        this.cm.setSelection(nextSelection)
      }
    }
  }

  render() {
    return (
      <div style={styles.editorContainer}>
        <div style={styles.editor} ref={'editor'} />
      </div>
    )
  }
}
