import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GPUPicker } from '/src/gpupicker.js';

var demoOptions = {
  useCPURaycast: false
};
var camera;
var scene;
var renderer;
var stats;
var mixers = [];

var raycaster = new THREE.Raycaster();
var rayDirection = new THREE.Vector2();

var gpuPicker;

var pixelRatio = window.devicePixelRatio ? 1.0 / window.devicePixelRatio : 1.0;

init();
animate();

function init() {

  var container = document.getElementById('container');

  // CAMERA

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(- 500, 500, 750);

  // SCENE

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  // LIGHTS

  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0.5, 0.5, 1);
  scene.add(light);

  var ambientLight = new THREE.AmbientLight(0x080808);
  scene.add(ambientLight);

  // RENDERER

  renderer = new THREE.WebGLRenderer();
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

  container.appendChild(renderer.domElement);

  gpuPicker = new GPUPicker(THREE, renderer, scene, camera, idFromObject);

  // CONTROLS

  var controls = new OrbitControls(camera, renderer.domElement);

  // STATS

  stats = new Stats();
  container.appendChild(stats.dom);

  // GUI

  setupGui();

  // EVENTS

  window.addEventListener('resize', onWindowResize, false);

  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('touchend', onMouseUp);

  // CPU picking will only work if you pick on the t-pose.
  var loader = new GLTFLoader().setPath('model/');
  loader.load('scene.gltf', function (gltf) {
    var mixer = new THREE.AnimationMixer(gltf.scene);
    var action = mixer.clipAction(gltf.animations[0]);
    action.play();
    mixers.push(mixer);
    scene.add(gltf.scene);
  });

  var geometry = new THREE.SphereGeometry(100, 500, 500, 0, Math.PI * 2, 0, Math.PI * 2);
  var material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  var sphere = new THREE.Mesh(geometry, material);
  var sphereGroup = new THREE.Group(); // To make objectToId happy.
  sphereGroup.position.x = -200;
  scene.add(sphereGroup);
  sphereGroup.add(sphere);

  // Sprite
  var map = new THREE.TextureLoader().load( 'model/rollerblades.png' );
  var spriteMaterial = new THREE.SpriteMaterial( { map: map } );
  var sprite = window.sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.fromArray([100, 100, 100]);
  sprite.center.set(0, 3);
  sprite.material.rotation = Math.PI / 4;
  sprite.position.x = 100;
  scene.add( sprite );

  // Unattenuated sprite
  var spriteMaterial = new THREE.SpriteMaterial( { map: map } );
  var sprite = window.sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.fromArray([0.3, 0.3, 0.3]);
  sprite.material.rotation = Math.PI / 4;
  sprite.material.sizeAttenuation = false;
  sprite.position.x = -450;
  sprite.position.y = -100;
  scene.add( sprite );
}

function setColor(id) {
  var obj = scene.getObjectById(id);
  if (!obj) {
    return;
  }
  var color = Math.random() * 0xffffff;
  obj.traverse(obj => {
    if (obj.material) {
      obj.material.color.setHex(color);
      obj.material.materialNeedsUpdate = true;
    }
  });
}

function onMouseUp(ev) {
  var result = demoOptions.useCPURaycast ? cpuPick(ev) : gpuPick(ev);
  setColor(result);
}

function cpuPick(ev) {
  rayDirection.x = (ev.clientX / (renderer.domElement.width * pixelRatio)) * 2 - 1;
  rayDirection.y = -(ev.clientY / (renderer.domElement.height * pixelRatio)) * 2 + 1;
  raycaster.setFromCamera(rayDirection, camera);
  var intersections = raycaster.intersectObject(scene, true);
  if (intersections.length) {
    return idFromObject(intersections[0].object);
  } else {
    return undefined;
  }
}

function gpuPick(ev) {
  var inversePixelRatio = 1.0 / pixelRatio;
  var objId = gpuPicker.pick(ev.clientX * inversePixelRatio, ev.clientY * inversePixelRatio);
  return idFromObject(scene.getObjectById(objId));
}

function idFromObject(obj) {
  var ret = obj;
  while (ret) {
    if (ret.parent.type === 'Scene') {
      return ret.id;
    } else {
      ret = ret.parent;
    }
  }
}

//
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}


function setupGui() {
  var gui = new GUI();
  gui.add(demoOptions, "useCPURaycast").name("Use CPU Raycasting");
}

function animate() {
  requestAnimationFrame(animate);
  mixers.forEach(mixer => {
    mixer.update(0.01);
  });
  renderer.render(scene, camera);
  stats.update();
}
