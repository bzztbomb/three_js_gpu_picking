/**
 * Fast GPU picker that handles dynamic scenes and objects for Three.JS
 *
 * @author bzztbomb https://github.com/bzztbomb
 * @author jfaust https://github.com/jfaust
 *
 * Developed at Torch3D (https://torch.app), thanks for allowing me to release this
 * nice little library!
 *
 */

var THREE;

var GPUPicker = function(three, renderer, scene, camera) {
  THREE = three;
  // This is the 1x1 pixel render target we use to do the picking
  var pickingTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.LinearEncoding
  });
  // We need to be inside of .render in order to call renderBufferDirect in renderList() so create an empty scene
  // and use the onAfterRender callback to actually render geometry for picking.
  var emptyScene = new THREE.Scene();
  emptyScene.onAfterRender = renderList;
  // RGBA is 4 channels.
  var pixelBuffer = new Uint8Array(4 * pickingTarget.width * pickingTarget.height);
  var clearColor = new THREE.Color(0xffffff);
  var materialCache = [];
  var shouldPickObjectCB = undefined;

  this.pick = function(x, y, shouldPickObject) {
    shouldPickObjectCB = shouldPickObject;
    var w = renderer.domElement.width;
    var h = renderer.domElement.height;
    // Set the projection matrix to only look at the pixel we are interested in.
    camera.setViewOffset(w, h, x, y, 1, 1);

    var currRenderTarget = renderer.getRenderTarget();
    var currClearColor = new THREE.Color();
    renderer.getClearColor(currClearColor);
    renderer.setRenderTarget(pickingTarget);
    renderer.setClearColor(clearColor);
    renderer.clear();
    renderer.render(emptyScene, camera);
    renderer.readRenderTargetPixels(pickingTarget, 0, 0, pickingTarget.width, pickingTarget.height, pixelBuffer);
    renderer.setRenderTarget(currRenderTarget);
    renderer.setClearColor(currClearColor);
    camera.clearViewOffset();

    var val = (pixelBuffer[0] << 24) + (pixelBuffer[1] << 16) + (pixelBuffer[2] << 8) + pixelBuffer[3];
    return val;
  }

  function renderList() {
    // This is the magic, these render lists are still filled with valid data.  So we can
    // submit them again for picking and save lots of work!
    var renderList = renderer.renderLists.get(scene, 0);
    renderList.opaque.forEach(item => processItem(item));
    renderList.transparent.forEach(item => processItem(item));
  }

  function processItem(renderItem) {
    var object = renderItem.object;
    if (shouldPickObjectCB && !shouldPickObjectCB(object)) {
      return;
    }
    var objId = object.id;
    var material = renderItem.material;
    var geometry = renderItem.geometry;

    var useMorphing = 0;

    if (material.morphTargets === true) {
      if (geometry.isBufferGeometry === true) {
        useMorphing =
          geometry.morphAttributes && geometry.morphAttributes.position && geometry.morphAttributes.position.length > 0
            ? 1
            : 0;
      } else if (geometry.isGeometry === true) {
        useMorphing = geometry.morphTargets && geometry.morphTargets.length > 0 ? 1 : 0;
      }
    }

    var useSkinning = object.isSkinnedMesh ? 1 : 0;
    var useInstancing = object.isInstancedMesh === true ? 1 : 0;
    var frontSide = material.side === THREE.FrontSide ? 1 : 0;
    var backSide = material.side === THREE.BackSide ? 1 : 0;
    var doubleSide = material.side === THREE.DoubleSide ? 1 : 0;
    var index =
      (useMorphing << 0) |
      (useSkinning << 1) |
      (useInstancing << 2) |
      (frontSide << 3) |
      (backSide << 4) |
      (doubleSide << 5);
    var renderMaterial = renderItem.object.pickingMaterial ? renderItem.object.pickingMaterial : materialCache[index];
    if (!renderMaterial) {
      renderMaterial = new THREE.ShaderMaterial({
        vertexShader: THREE.ShaderChunk.meshbasic_vert,
        fragmentShader: `
          uniform vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
        side: material.side,
      });
      renderMaterial.skinning = useSkinning > 0,
      renderMaterial.morphTargets = useMorphing > 0,
      renderMaterial.uniforms = {
        objectId: { value: [1.0, 1.0, 1.0, 1.0] },
      };
      materialCache[index] = renderMaterial;
    }
    renderMaterial.uniforms.objectId.value = [
      ( objId >> 24 & 255 ) / 255,
      ( objId >> 16 & 255 ) / 255,
      ( objId >> 8 & 255 ) / 255,
      ( objId & 255 ) / 255,
    ];
    renderMaterial.uniformsNeedUpdate = true;
    renderer.renderBufferDirect(camera, null, geometry, renderMaterial, object, null);
  }
}

export { GPUPicker };
