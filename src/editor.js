import React, { Component, createRef } from 'react'
import { instance } from './lib/fabric'
import { fabric } from 'fabric'
import { List, Stack } from 'immutable'
import { 
  VerticalAlignTopOutlined, 
  VerticalAlignBottomOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons'
import './editor.css'

function randomColor(){
  return '#'+Math.floor(Math.random()*16777215).toString(16);
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

const inBoundries = (n, low, high) => n >= low && n <= high

const inSize = (list, n) => inBoundries(n, 0, list.size - 1)

function swap(list, from, to) {
  if (!inSize(list, from) || !inSize(list, to)) return list
  const first = list.get(from)
  const second = list.get(to)
  return list.set(from, second).set(to, first)
}

function moveTop(list, item) {
  const itemIndex = list.indexOf(item)
  if (itemIndex < 0) return list
  return list.delete(itemIndex).insert(list.size - 1, item)
}

function moveBottom(list, item) {
  const itemIndex = list.indexOf(item)
  if (itemIndex < 0) return list
  return list.delete(itemIndex).insert(0, item)
}

function moveUp(list, item) {
  const itemIndex = list.indexOf(item)
  if (itemIndex < 0) return list
  return swap(list, itemIndex, itemIndex + 1)
}

function moveDown(list, item) {
  const itemIndex = list.indexOf(item)
  if (itemIndex < 0) return list
  return swap(list, itemIndex, itemIndex - 1)
}

let count = 0
export default class Editor extends Component {
  canvas = null
  uploaderRef = createRef(null)
  state = { layers: List(), mounted: false, activeIndex: -1 }

  constructor(props) {
    super(props);

    document.addEventListener('keydown', this.onEditorKeyDown)
  }
  

  componentDidMount() {
    console.dir(this.canvas)
    console.log('instance', instance)
    instance.initialize(this.canvas, {
      preserveObjectStacking: true,
      width: 800,
      height: 600,
    })
    this.setState({ mounted: true })
    console.log(instance)
  }

  componentWillUnmount() {
    this.setState({ mounted: false })
  }

  addLayers = (layer, name = count++) => {
    Object.defineProperty(layer, 'name', {
      value: name
    })
    const { layers } = this.state
    const changedLayers = layers.push(layer)
    const activeIndex = changedLayers.findKey(l => l.name === name)

    this.setState({
      activeIndex,
      layers: changedLayers,
    })
  }

  removeLayer = (layer) => {
    const oldLayers = this.state.layers
    const layers = oldLayers.remove(oldLayers.findKey(l => l === layer))
    this.setState({ layers })
  }

  onShapeSelect = name => {
    const { layers } = this.state
    this.setState({ activeIndex: layers.findKey(l => l.name === name) })
  }

  onAddRectangle = () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 50,
      fill: randomColor(),
      width: 200,
      height: 100,
      objectCaching: false,
      hasRotatingPoint: true
    })
    const name = `rect_${count++}`
    rect.on('selected', () => this.onShapeSelect(name))
    instance.add(rect)
    instance.setActiveObject(rect)
    this.addLayers(rect, name)
  }

  onUploadImage = (e) => {
    this.uploaderRef.current.click()
  }

  onUploaderChange = async e => {
    const file = e.target.files[0]
    const image = await getBase64(file)

    fabric.Image.fromURL(image, oImg => {
      const name = file.name
      oImg.set({
        left: 100,
        top: 100,
        scaleX: 0.25,
        scaleY: 0.25
      })
      oImg.on('selected', () => this.onShapeSelect(name))
      instance.add(oImg)
      instance.setActiveObject(oImg)
      this.addLayers(oImg, file.name)
    })
  }

  onEditorKeyDown = e => {
    if (e.key === 'Delete' && this.state.mounted) {
      const activeObject = instance.getActiveObject()
      instance.remove(activeObject)
      this.removeLayer(activeObject)
    }
  }

  onDragLayer = e => {
    console.log('onDragLayer', e);
  }

  handleLayerMovement = (direction) => e => {
    console.log('onLayerMove', e);
    // e.preventDefault()
    e.stopPropagation()
    const { layers, activeIndex } = this.state
    const layer = layers.get(activeIndex)
    const changedLayers = 
      direction === 'top' ? moveTop(layers, layer)
        : direction === 'bottom' ? moveBottom(layers, layer)
          : direction === 'up' ? moveUp(layers, layer)
            : direction === 'down' ? moveDown(layers, layer)
              : layers
    
    console.log('change direction', direction)
    const changedActiveIndex = changedLayers.findKey(l => l === layer) 
    console.log('activeIndex', changedActiveIndex, 'oldIndex', layers.findKey(l => l === layer))
    this.setState({ activeIndex: changedActiveIndex, layers: changedLayers })
    changedLayers.forEach((l, index) => {
      instance.moveTo(l, index)
    })
    // instance.renderAll()
  }

  handleLayerClick = layer => e => {
    const { layers } = this.state
    console.log('selected layer:', layer);
    const activeIndex = layers.findKey(l => l === layer)
    console.log('key', activeIndex);
    this.setState({ activeIndex })
    instance.setActiveObject(layer)
    instance.renderAll()
  }

  renderLayers = () => {
    const { layers, activeIndex } = this.state

    return (
      <div className="layers">
        <p>Layers:</p>
        {layers.map((layer, index) => (
          <div 
            className={`layer ${activeIndex === index ? 'active' : ''}`} 
            key={layer.name}
            onClick={this.handleLayerClick(layer)}>
            <p>
              {index}: {layer.name}
            </p>
          </div>
        )).reverse()}
      </div>
    )
  }

  render() {
    return (
      <div className="editor">
        <button onClick={this.onUploadImage}>Upload Image</button>
        <input 
          type="file"
          style={{display: 'none'}} 
          accept=".jpg,.jpeg,.svg,.png"
          onChange={this.onUploaderChange}
          ref={this.uploaderRef} />
        <button onClick={this.onAddRectangle}>Add Rect</button>

        <div className="main-panel">
          <canvas
            ref={ref => this.canvas = ref}
            style={{'border': '1px solid #ccc'}}>
          </canvas>

          <div className="right">
            <div className="layer-actions">
              <p>Layer Actions</p>
              <VerticalAlignTopOutlined onClick={this.handleLayerMovement('top')} />
              <ArrowUpOutlined onClick={this.handleLayerMovement('up')} />
              <ArrowDownOutlined onClick={this.handleLayerMovement('down')} />
              <VerticalAlignBottomOutlined onClick={this.handleLayerMovement('bottom')} />
            </div>
            {this.renderLayers()}
          </div>
        </div>
      </div>
    )
  }
}