import * as THREE from './vendor/three.module.min.js';

const container = document.querySelector('.game-canvas');
const map = document.querySelector('.research-map');
const startButton = document.querySelector('.game-start');
const encounter = document.querySelector('.paper-encounter');
const encounterNumber = document.querySelector('#encounter-number');
const encounterTitle = document.querySelector('.encounter-title');
const encounterMeta = document.querySelector('.encounter-meta');
const encounterNote = document.querySelector('.encounter-note');
const encounterLinks = document.querySelector('.encounter-links');
const paperElements = [...document.querySelectorAll('.paper[data-topics]')];
const allPapersDialog = document.querySelector('#all-papers-dialog');
const allPapersTrigger = document.querySelector('.papers-direct-link');
const paperTabs = [...allPapersDialog.querySelectorAll('[data-paper-tab]')];
function setPaperTab(topic){
  paperTabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.paperTab === topic)));
  allPapersDialog.querySelectorAll('.all-papers-group').forEach(group => {
    group.hidden = topic !== 'all' && group.dataset.topic !== topic && group.dataset.topic !== 'both';
  });
  allPapersDialog.querySelector('.all-papers-scroll').scrollTop = 0;
}
paperTabs.forEach(tab => tab.addEventListener('click', () => setPaperTab(tab.dataset.paperTab)));
allPapersTrigger.addEventListener('click', () => {
  pressed.clear();
  resetStick();
  allPapersDialog.showModal();
  setPaperTab('all');
});
allPapersDialog.querySelector('.all-papers-close').addEventListener('click', () => allPapersDialog.close());
allPapersDialog.addEventListener('close', () => allPapersTrigger.focus());

const paperData = [
  { number:'01', zone:'tech',  x:12,  z:-2 },
  { number:'02', zone:'labor', x:-13, z:3 },
  { number:'03', zone:'labor', x:-10, z:-4 },
  { number:'04', zone:'labor', x:-15, z:-7 },
  { number:'05', zone:'both',  x:4,   z:1 },
  { number:'06', zone:'labor', x:-7,  z:7 },
  { number:'07', zone:'labor', x:-13, z:10 },
  { number:'08', zone:'tech',  x:14,  z:8, arrivalX:11.4, arrivalZ:8.7 }
];

const zoneColors = {
  labor:0x7a1f2b,
  both:0x6c426f,
  tech:0x092f57
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8eaab0);
scene.fog = new THREE.Fog(0x8eaab0, 38, 72);

const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, .1, 100);
camera.position.set(13, 18, 17);
camera.lookAt(0, 0, 0);
const zoomButtons = [...document.querySelectorAll('[data-zoom]')];
const minZoom = .8;
const maxZoom = 2.4;
camera.zoom = 1.2;
function setZoom(nextZoom){
  camera.zoom = THREE.MathUtils.clamp(nextZoom, minZoom, maxZoom);
  camera.updateProjectionMatrix();
  zoomButtons.forEach(button => {
    button.disabled = button.dataset.zoom === 'in'
      ? camera.zoom >= maxZoom - .001
      : camera.zoom <= minZoom + .001;
  });
}
zoomButtons.forEach(button => button.addEventListener('click', () => {
  setZoom(camera.zoom * (button.dataset.zoom === 'in' ? 1.25 : .8));
}));
setZoom(camera.zoom);

const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.tabIndex = 0;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfffbef, 0x7f8d80, 2.1));
const sun = new THREE.DirectionalLight(0xfff3dc, 3.2);
sun.position.set(-10, 22, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const collisionObstacles = [];

const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshBasicMaterial({color:0x8eaab0})
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -.31;
world.add(sea);

const coastline = [
  [-19,-10],[-17,-13],[-11,-13.5],[-6,-12.7],[0,-13.3],[7,-12.8],
  [13,-12],[18,-10],[20,-7],[20,0],[21,6],[18,10],[13,12],
  [6,12.6],[0,12],[-6,13.5],[-13,13],[-18,11],[-20,7],
  [-20,2],[-21,-3],[-20,-7]
];
const coastCurve = new THREE.CatmullRomCurve3(
  coastline.map(([x,z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', .28
);
const coastPoints = coastCurve.getPoints(96).map(point => [point.x * 1.12, point.z * 1.12]);
function islandGeometry(scale){
  const shape = new THREE.Shape();
  coastPoints.forEach(([x,z], index) => {
    if (index === 0) shape.moveTo(x * scale, -z * scale);
    else shape.lineTo(x * scale, -z * scale);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}
function addIslandLayer(scale, y, color){
  const land = new THREE.Mesh(islandGeometry(scale), new THREE.MeshLambertMaterial({color, side:THREE.DoubleSide}));
  land.rotation.x = -Math.PI / 2;
  land.position.y = y;
  land.receiveShadow = true;
  world.add(land);
}
addIslandLayer(1, -.12, 0xd2c7a5);
addIslandLayer(.975, 0, 0x9caf88);

function isOnIsland(x, z){
  let inside = false;
  for (let i = 0, j = coastPoints.length - 1; i < coastPoints.length; j = i++){
    const [xi,zi] = coastPoints[i];
    const [xj,zj] = coastPoints[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const glints = [];
for (let i = 0; i < 26; i++){
  const [shoreX, shoreZ] = coastPoints[Math.floor(i * coastPoints.length / 26)];
  const distance = 1.12 + (i % 3) * .035;
  const x = shoreX * distance;
  const z = shoreZ * distance;
  const material = new THREE.MeshBasicMaterial({color:0xd5e1df, transparent:true, opacity:.14, depthWrite:false});
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(.72 + (i%3)*.22, .045), material);
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = Math.atan2(z, x) * .25;
  glint.position.set(x, -.28, z);
  world.add(glint);
  glints.push({mesh:glint, phase:i * .83, x});
}

function addGroundPatch(x, z, radius, color, scaleX = 1){
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 12),
    new THREE.MeshLambertMaterial({color, flatShading:true})
  );
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = (x + z) * .08;
  patch.scale.x = scaleX;
  patch.position.set(x, .012, z);
  patch.receiveShadow = true;
  world.add(patch);
}

[
  [-11,5,3.4,0x8ea57b,1.3],[-8,-6,3.2,0xa9b98e,1.2],
  [9,5,3.6,0xa8b98e,1.2],[10,-5,3.2,0x8fa57c,1.2],
  [0,-7,3.1,0xa5b58a,1.3],[-1,8,2.9,0x91a97d,1.25]
].forEach(args => addGroundPatch(...args));

function addRibbonPath(points, width, color, y){
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x,z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    .38
  );
  const samples = curve.getPoints(72);
  const positions = [];
  const indices = [];
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    const localWidth = width * (1 + Math.sin(index * .63) * .035);
    positions.push(
      point.x + nx * localWidth * .5, point.y, point.z + nz * localWidth * .5,
      point.x - nx * localWidth * .5, point.y, point.z - nz * localWidth * .5
    );
    if (index < samples.length - 1){
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const path = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({color, flatShading:true, side:THREE.DoubleSide})
  );
  path.receiveShadow = true;
  world.add(path);
}

const northSouthPath = [[-16,11],[-10,8],[-3,7],[1,4],[0,0],[3,-4],[9,-7],[17,-9]];
const westEastPath = [[-18,-5],[-14,-3],[-9,0],[-3,2],[1,4],[7,5],[12,2],[18,3]];
[northSouthPath, westEastPath].forEach(points => {
  addRibbonPath(points, 5.05, 0xb9aa91, .035);
  addRibbonPath(points, 4.48, 0x70766f, .055);
});

function addPathDashes(points){
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x,z]) => new THREE.Vector3(x, .085, z)),
    false,
    'catmullrom',
    .38
  );
  const marks = curve.getSpacedPoints(24);
  marks.forEach((point, index) => {
    if (index === 0 || index === marks.length - 1 || index % 2 === 0) return;
    const previous = marks[index - 1];
    const next = marks[index + 1];
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(.09, .025, .72),
      new THREE.MeshBasicMaterial({color:0xded5bf})
    );
    dash.position.copy(point);
    dash.rotation.y = Math.atan2(next.x - previous.x, next.z - previous.z);
    world.add(dash);
  });
}

addPathDashes(northSouthPath);
addPathDashes(westEastPath);

function carNameTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.fillStyle = '#7a1f2b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f7f3e8';
  context.font = '600 176px Jost, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Ping', canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addPetalFlower(group, x, z, color, scale, phase){
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(.035, .05, .72 * scale, 5),
    new THREE.MeshLambertMaterial({color:0x4b6c49})
  );
  stem.position.set(x, .36 * scale, z);
  stem.castShadow = true;
  group.add(stem);

  const bloomMaterial = new THREE.MeshLambertMaterial({color, flatShading:true});
  for (let index = 0; index < 5; index += 1){
    const petal = new THREE.Mesh(new THREE.SphereGeometry(.13 * scale, 5, 4), bloomMaterial);
    const angle = phase + index * Math.PI * .4;
    petal.scale.set(1.35, .42, .8);
    petal.position.set(
      x + Math.cos(angle) * .13 * scale,
      .77 * scale,
      z + Math.sin(angle) * .13 * scale
    );
    petal.castShadow = true;
    group.add(petal);
  }
}

function addShrub(group, x, z, color, scale){
  const material = new THREE.MeshLambertMaterial({color, flatShading:true});
  [[0,0,.62],[.38,.05,.46],[-.34,.02,.5],[.08,.28,.42]].forEach(([dx,dz,size]) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(size * scale, 1), material);
    crown.position.set(x + dx * scale, size * scale, z + dz * scale);
    crown.castShadow = true;
    group.add(crown);
  });
}

function addAgave(group, x, z, color, scale, phase){
  const material = new THREE.MeshLambertMaterial({color, flatShading:true});
  for (let index = 0; index < 9; index += 1){
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.16 * scale, 1.05 * scale, 5), material);
    const angle = phase + index * Math.PI * 2 / 9;
    leaf.position.set(
      x + Math.cos(angle) * .22 * scale,
      .35 * scale,
      z + Math.sin(angle) * .22 * scale
    );
    leaf.rotation.z = Math.cos(angle) * .72;
    leaf.rotation.x = Math.sin(angle) * .72;
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function addTree(x, z, scale = 1){
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(.18, .25, 1.25, 6),
    new THREE.MeshLambertMaterial({color:0x79583d})
  );
  trunk.position.y = .62;
  trunk.castShadow = true;
  tree.add(trunk);
  [[0,0,.82],[-.42,.03,.58],[.38,.02,.62],[.02,.42,.56]].forEach(([dx,dz,size], index) => {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 1),
      new THREE.MeshLambertMaterial({color:index % 2 ? 0x66805c : 0x4d7258, flatShading:true})
    );
    crown.position.set(dx, 1.45 + size * .35, dz);
    crown.castShadow = true;
    tree.add(crown);
  });
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  world.add(tree);
  collisionObstacles.push({x, z, radius:.72 * scale});
}

[
  [-18,-10],[-18,8],[-16,11],[-5,11],[7,11],[18,6],[18,-8],
  [-7,-10],[7,-10],[18,3],[-18,0]
].forEach(([x,z], index) => addTree(x, z, .8 + (index % 3) * .12));

function addGrassClusterTo(parent, x, z, scale = 1, bloom = null){
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({color:0x597653, flatShading:true});
  for (let index = 0; index < 5; index += 1){
    const blade = new THREE.Mesh(new THREE.ConeGeometry(.07 * scale, .65 * scale, 4), material);
    const angle = index * Math.PI * .4;
    blade.position.set(Math.cos(angle) * .14 * scale, .3 * scale, Math.sin(angle) * .14 * scale);
    blade.rotation.z = Math.cos(angle) * .25;
    blade.rotation.x = Math.sin(angle) * .25;
    blade.castShadow = true;
    group.add(blade);
  }
  if (bloom !== null){
    const flower = new THREE.Mesh(
      new THREE.IcosahedronGeometry(.12 * scale, 0),
      new THREE.MeshLambertMaterial({color:bloom, flatShading:true})
    );
    flower.position.y = .68 * scale;
    flower.castShadow = true;
    group.add(flower);
  }
  group.position.set(x, 0, z);
  parent.add(group);
  return group;
}

function addGrassCluster(x, z, scale = 1, bloom = null){
  return addGrassClusterTo(world, x, z, scale, bloom);
}

[
  [-15,6,.9,0xd5c58e],[-10,8,.72,0x8f4350],[-5,9,.8,null],[5,8,.82,0x5c7190],
  [12,6,.74,0xd4c591],[16,4,.86,null],[-16,-2,.76,0x8f4350],[-7,-5,.82,null],
  [7,-5,.78,0x6d4f78],[16,-2,.9,0x456b82],[-5,4,.7,0xd3c28b],[8,4,.68,null]
].forEach(args => addGrassCluster(...args));

function makeRover(){
  const rover = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({color:0x7a1f2b, shininess:55, flatShading:true});
  const trim = new THREE.MeshPhongMaterial({color:0x16191d, shininess:35});
  const chrome = new THREE.MeshPhongMaterial({color:0xb9b8ad, shininess:90});
  const glass = new THREE.MeshPhongMaterial({color:0x173d55, shininess:95});

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, .34, 3.25), paint);
  chassis.position.y = .57;
  chassis.castShadow = true;
  rover.add(chassis);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.82, .2, 1.32), paint);
  hood.position.set(0, .81, .92);
  hood.castShadow = true;
  rover.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, .58, 1.28), glass);
  cabin.position.set(0, 1.02, -.42);
  cabin.scale.set(1, 1, .92);
  cabin.rotation.x = -.04;
  cabin.castShadow = true;
  rover.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.38, .13, .92), paint);
  roof.position.set(0, 1.36, -.48);
  roof.castShadow = true;
  rover.add(roof);

  const stripeMaterial = new THREE.MeshBasicMaterial({color:0xe2d8bf});
  [-.2,.2].forEach(x => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.13, .025, 2.42), stripeMaterial);
    stripe.position.set(x, .93, .43);
    rover.add(stripe);
  });

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.55, .28, .08), trim);
  grille.position.set(0, .62, 1.67);
  rover.add(grille);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.86, .09, .12), chrome);
  bumper.position.set(0, .42, 1.72);
  rover.add(bumper);

  const headlightMaterial = new THREE.MeshBasicMaterial({color:0xffe9ae});
  [-.62,.62].forEach(x => {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.06,12), headlightMaterial);
    light.rotation.x = Math.PI / 2;
    light.position.set(x, .69, 1.72);
    rover.add(light);
  });

  const tailMaterial = new THREE.MeshBasicMaterial({color:0xb9212e});
  [-.57,.57].forEach(x => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .05), tailMaterial);
    light.position.set(x, .61, -1.66);
    rover.add(light);
  });

  const roofMark = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, .56),
    new THREE.MeshBasicMaterial({map:carNameTexture()})
  );
  roofMark.rotation.x = -Math.PI / 2;
  roofMark.rotation.z = Math.PI;
  roofMark.position.set(0, 1.435, -.48);
  rover.add(roofMark);

  const wheelMaterial = new THREE.MeshPhongMaterial({color:0x141518, shininess:12});
  const rimMaterial = new THREE.MeshPhongMaterial({color:0xc2c0b5, shininess:100});
  [[-1.02,.44,1.02],[1.02,.44,1.02],[-1.02,.44,-1.03],[1.02,.44,-1.03]].forEach(([x,y,z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.28,16), wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x,y,z);
    wheel.castShadow = true;
    rover.add(wheel);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.295,10), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x,y,z);
    rover.add(rim);
  });

  const rearSpoiler = new THREE.Mesh(new THREE.BoxGeometry(1.62, .08, .22), trim);
  rearSpoiler.position.set(0, 1.03, -1.5);
  rover.add(rearSpoiler);
  [-.56,.56].forEach(x => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(.07, .25, .07), trim);
    support.position.set(x, .9, -1.5);
    rover.add(support);
  });

  rover.scale.setScalar(.82);
  rover.position.set(0, .02, 7);
  rover.rotation.y = Math.PI;
  world.add(rover);
  return rover;
}

const rover = makeRover();
const hoverJets = [[-1.02,1.02],[1.02,1.02],[-1.02,-1.03],[1.02,-1.03]].map(([x,z]) => {
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(.04,.22,1,8,1,true),
    new THREE.MeshBasicMaterial({color:0x9fcbd1, transparent:true, opacity:.42,
      depthWrite:false, side:THREE.DoubleSide}));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.025,.08,1,8,1,true),
    new THREE.MeshBasicMaterial({color:0xe4f6f1, transparent:true, opacity:.75,
      depthWrite:false, side:THREE.DoubleSide}));
  const particles = [0,1,2].map(() => new THREE.Mesh(new THREE.SphereGeometry(.055,6,4),
    new THREE.MeshBasicMaterial({color:0xe4f6f1, transparent:true, opacity:.7, depthWrite:false})));
  const splash = new THREE.Mesh(new THREE.RingGeometry(.18,.28,16),
    new THREE.MeshBasicMaterial({color:0xe9f5ee, transparent:true, opacity:.4,
      depthWrite:false, side:THREE.DoubleSide}));
  splash.rotation.x = -Math.PI / 2;
  splash.position.y = -.263;
  splash.visible = false;
  outer.visible = false;
  core.visible = false;
  particles.forEach(particle => { particle.visible = false; });
  rover.add(outer, core, ...particles);
  world.add(splash);
  return {x,z,outer,core,particles,splash};
});
const wakes = Array.from({length:8}, () => {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(.42,.49,20),
    new THREE.MeshBasicMaterial({color:0xe3f0e9, transparent:true, opacity:0,
      depthWrite:false, side:THREE.DoubleSide}));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -.268;
  mesh.visible = false;
  world.add(mesh);
  return {mesh, age:2};
});
const waterline = new THREE.Mesh(new THREE.RingGeometry(.82,.94,28),
  new THREE.MeshBasicMaterial({color:0xe3f0e9, transparent:true, opacity:.35,
    depthWrite:false, side:THREE.DoubleSide}));
waterline.rotation.x = -Math.PI / 2;
waterline.position.y = -.267;
waterline.visible = false;
world.add(waterline);
let wakeTimer = 0;
const minimapField = document.querySelector('.minimap-field');
const minimapIsland = document.querySelector('.minimap-island');
const minimapCar = document.querySelector('.minimap-car');
const mapPercent = (value, limit) => `${50 + value / limit * 50}%`;
minimapIsland.style.clipPath = `polygon(${coastPoints.map(([x,z]) => `${mapPercent(x,27)} ${mapPercent(z,19)}`).join(',')})`;
paperData.forEach(paper => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'minimap-point';
  button.dataset.zone = paper.zone;
  button.title = 'Explore paper location';
  button.setAttribute('aria-label', 'Explore paper location');
  paper.minimapButton = button;
  button.style.left = mapPercent(paper.x, 27);
  button.style.top = mapPercent(paper.z, 19);
  button.addEventListener('click', () => {
    started = true;
    map.classList.add('is-started');
    document.body.classList.add('is-started');
    rover.position.set(paper.arrivalX ?? paper.x, .02, paper.arrivalZ ?? Math.min(11.5, paper.z + 2.8));
    rover.rotation.y = Math.PI;
    speed = 0;
    pressed.clear();
    showPaper(paper);
    renderer.domElement.focus();
  });
  minimapField.appendChild(button);
});

const animatedScenes = [];
const mat = color => new THREE.MeshLambertMaterial({color, flatShading:true});
function block(parent, x, y, z, width, height, depth, color){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function makePuppet(role, outfitColor){
  const figure = new THREE.Group();
  const outfits = {
    person:0x667d70, accountant:0x596b72, manager:0x7a1f2b,
    analyst:0x526d80, irs:0x294d67, researcher:0x607665, llm:0x496875
  };
  const coat = outfitColor ?? outfits[role] ?? outfits.person;
  block(figure, 0, .6, 0, .4, .48, .27, coat);
  [-.3,.3].forEach((x, index) => {
    const arm = block(figure, x, .58, .01, .12, .4, .14, coat);
    arm.rotation.z = index ? -.13 : .13;
  });
  [-.13,.13].forEach(x => block(figure, x, .18, 0, .14, .34, .17, 0x343b3d));
  if (role === 'llm'){
    block(figure, 0, 1.04, 0, .48, .42, .34, 0x213745);
    block(figure, 0, 1.04, .178, .37, .28, .015, 0xa8c6bf);
    [-.1,.1].forEach(x => block(figure, x, 1.08, .19, .045, .045, .02, 0x092f57));
    block(figure, 0, .96, .19, .17, .025, .02, 0x7a1f2b);
  } else {
    const head = new THREE.Mesh(new THREE.SphereGeometry(.23, 10, 8), mat(0xdfb798));
    head.position.y = 1.04;
    head.castShadow = true;
    figure.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.235, 10, 6, 0, Math.PI * 2, 0, Math.PI * .38), mat(0x2c3032));
    hair.position.y = 1.055;
    figure.add(hair);
  }
  if (role === 'manager' || role === 'irs'){
    const color = role === 'manager' ? (outfitColor ?? 0x6b202b) : 0x173d55;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.045,12), mat(color));
    brim.position.y = 1.27;
    figure.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(.2,.23,.16,10), mat(color));
    crown.position.y = 1.36;
    figure.add(crown);
  }
  if (role === 'researcher'){
    [-.115,.115].forEach(x => {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(.092,.018,4,10), mat(0x1e2d31));
      lens.position.set(x, 1.04, .205);
      figure.add(lens);
    });
  }
  if (role === 'accountant'){
    const calculator = block(figure, .33, .58, .24, .31, .4, .07, 0x263b46);
    calculator.rotation.z = -.12;
    block(calculator, 0, .12, .042, .23, .085, .009, 0xdbe8d9);
    [-.08, 0, .08].forEach((x, column) => {
      [.025, -.055, -.135].forEach((y, row) => {
        block(calculator, x, y, .042, .052, .047, .009,
          column === 2 && row === 2 ? 0x9b4a50 : 0xf0e8d9);
      });
    });
  }
  if (role === 'analyst'){
    const chart = block(figure, .31, .59, .24, .29, .34, .045, 0xe7dfc5);
    chart.rotation.z = -.15;
    [.08,.17,.12].forEach((height, index) => {
      block(chart, -.085 + index * .085, -.11 + height / 2, .03, .045, height, .008, 0x092f57);
    });
  }
  if (role === 'researcher'){
    const leftPage = block(figure, .23, .59, .24, .17, .31, .045, 0xf1ecd9);
    const rightPage = block(figure, .4, .59, .24, .17, .31, .045, 0xe9dfc7);
    leftPage.rotation.y = -.22;
    rightPage.rotation.y = .22;
    block(figure, .315, .59, .27, .018, .32, .012, 0x7a1f2b);
  }
  if (role === 'irs'){
    block(figure, -.11, .7, .145, .13, .1, .015, 0xf3eee1);
    const emblem = block(figure, -.11, .7, .16, .052, .052, .012, 0x092f57);
    emblem.rotation.z = Math.PI / 4;
  }
  if (role === 'manager') block(figure, 0, .7, .15, .08, .24, .02, 0xe2d6b7);
  return figure;
}
function person(parent, x, z, role = 'person', outfitColor){
  const figure = makePuppet(role, outfitColor);
  figure.position.set(x, 0, z);
  parent.add(figure);
  return figure;
}
const castRoles = [
  ['person','Person','Employee, taxpayer, or investor'],
  ['accountant','Accountant','Accountant or auditor'],
  ['manager','Manager','CEO, firm leader, or client manager'],
  ['analyst','Analyst','Sell-side analyst'],
  ['irs','IRS staff','Tax assistance staff'],
  ['researcher','Researcher','Academic author'],
  ['llm','LLM','AI generating text or recommendations']
];
const castToggle = document.querySelector('.cast-toggle');
const castPanel = document.querySelector('.cast-panel');
const castClose = document.querySelector('.cast-close');
const castGrid = document.querySelector('.cast-grid');
let castRendered = false;
function renderCast(){
  if (castRendered) return;
  castRendered = true;
  const preview = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
  preview.setPixelRatio(1.5);
  preview.setSize(160, 140);
  preview.outputColorSpace = THREE.SRGBColorSpace;
  const previewScene = new THREE.Scene();
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0x82908c, 2.2));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-2, 4, 5);
  previewScene.add(light);
  const previewCamera = new THREE.PerspectiveCamera(35, 160 / 140, .1, 20);
  previewCamera.position.set(1.35, 1.55, 2.75);
  previewCamera.lookAt(0, .68, 0);
  castRoles.forEach(([role,label,meaning]) => {
    const puppet = makePuppet(role);
    previewScene.add(puppet);
    preview.render(previewScene, previewCamera);
    const member = document.createElement('div');
    member.className = 'cast-member';
    const image = document.createElement('img');
    image.src = preview.domElement.toDataURL('image/png');
    image.alt = `${label} puppet`;
    member.append(image);
    const caption = document.createElement('span');
    caption.textContent = label;
    member.append(caption);
    const description = document.createElement('p');
    description.textContent = meaning;
    member.append(description);
    castGrid.append(member);
    previewScene.remove(puppet);
  });
  preview.dispose();
}
function setCastOpen(open){
  if (open) renderCast();
  castPanel.hidden = !open;
  castToggle.setAttribute('aria-expanded', String(open));
  if (open){ pressed.clear(); castClose.focus(); }
  else castToggle.focus();
}
castToggle.addEventListener('click', () => setCastOpen(true));
castClose.addEventListener('click', () => setCastOpen(false));
castPanel.addEventListener('click', event => { if (event.target === castPanel) setCastOpen(false); });
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !castPanel.hidden) setCastOpen(false);
  if (event.code === 'KeyC' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey){
    event.preventDefault();
    setCastOpen(castPanel.hidden);
  }
});
function paperSheet(parent, x, z, color = 0xf4f0df){
  const sheet = new THREE.Group();
  sheet.position.set(x, .42, z);
  block(sheet, 0, 0, 0, .42, .06, .56, color);
  for (let i = 0; i < 3; i++) block(sheet, 0, .039, -.16 + i * .13, .25, .008, .025, 0x6d706c);
  parent.add(sheet);
  return sheet;
}
function platform(parent, color){
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.4, .16, 10), mat(color));
  base.position.y = .07;
  base.receiveShadow = true;
  parent.add(base);
}
function iconTexture(symbol, color){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.font = 'bold 104px Jost, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(symbol, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function pulse(parent, color, size = .09){
  const signal = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), mat(color));
  parent.add(signal);
  return signal;
}
function makePaperScene(paper, parent){
  const motion = [];
  const red = zoneColors.labor;
  const blue = zoneColors.tech;
  platform(parent, 0xb0ac97);
  if (paper.number === '01'){
    // Questions cross the table while the manager dodges along the opposite short edge.
    block(parent, 0, .27, 0, 2.1, .12, 1.4, blue);
    const analyst = person(parent, -1.13, 0, 'analyst');
    analyst.rotation.y = Math.PI / 2;
    const manager = person(parent, 1.13, 0, 'manager');
    manager.rotation.y = -Math.PI / 2;
    const questionCanvas = document.createElement('canvas');
    questionCanvas.width = questionCanvas.height = 128;
    const context = questionCanvas.getContext('2d');
    context.fillStyle = '#092f57';
    context.beginPath();
    context.arc(64, 64, 55, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f6f3ee';
    context.font = '700 82px Jost, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('?', 64, 69);
    const questionTexture = new THREE.CanvasTexture(questionCanvas);
    questionTexture.colorSpace = THREE.SRGBColorSpace;
    const questions = [0,1,2].map(() => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:questionTexture, transparent:true, depthWrite:false}));
      sprite.scale.set(.35, .35, 1);
      parent.add(sprite);
      return sprite;
    });
    motion.push(t => {
      let dodge = 0;
      questions.forEach((sprite, index) => {
        const progress = (t * .42 + index / 3) % 1;
        sprite.position.set(-.94 + progress * 1.9, .87 + Math.sin(t * 2 + index) * .045, (index - 1) * .25);
        sprite.material.opacity = Math.min(1, (1 - progress) * 8);
        dodge = Math.max(dodge, Math.max(0, 1 - Math.abs(progress - .78) / .16));
      });
      manager.position.z = Math.sin(t * 1.9) * .55;
      manager.rotation.z = -dodge * .16;
    });
  } else if (paper.number === '02'){
    // Equivalent accountants stay put; recognition lets goods move across the border.
    block(parent, 0, .24, 0, .06, .04, 2.3, 0xf5f0de);
    person(parent, -.82, -.55, 'accountant');
    person(parent, .82, -.55, 'accountant');
    const crate = block(parent, -.86, .31, .53, .45, .35, .35, red);
    paperSheet(parent, -.82, .02);
    paperSheet(parent, .82, .02);
    motion.push(t => {
      crate.position.x = -.86 + ((t * .38) % 1.72);
    });
  } else if (paper.number === '03'){
    // Two firm leaders face each other across a state line; the accountant takes the front lane.
    block(parent, 0, .19, .5, 2.25, .06, .27, 0xd6c6a9);
    block(parent, 0, .24, -.35, .06, .04, 1.45, 0xf5f0de);
    person(parent, -.85, -.48, 'manager', blue);
    person(parent, .85, -.48, 'manager', red);
    const auditor = person(parent, -.82, .68, 'accountant');
    motion.push(t => {
      auditor.position.x = Math.sin(t * .9) * .82;
      auditor.rotation.y = Math.cos(t * .9) > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
  } else if (paper.number === '04'){
    // Control problems sit behind an employee's visible satisfaction rating.
    block(parent, -.5, .4, .15, .74, .55, .86, blue);
    const employee = person(parent, .65, .12, 'person');
    const stacks = [0,1,2].map(i => paperSheet(parent, -.65 + i * .25, .1 + i * .13));
    const warning = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), mat(red));
    warning.position.set(-.5, 1.05, .15);
    parent.add(warning);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(.72, 1.08, .04),
      new THREE.MeshPhongMaterial({color:0xb4d0ce, transparent:true, opacity:.34}));
    glass.position.set(.65, .68, .57);
    parent.add(glass);
    block(parent, .65, .7, .61, .25, .4, .05, 0x263840);
    block(parent, .65, .72, .64, .2, .3, .012, 0xf1e9dd);
    const heartTexture = iconTexture('♥', '#9b2737');
    const hearts = [0,1,2].map(() => {
      const heart = new THREE.Sprite(new THREE.SpriteMaterial({map:heartTexture, transparent:true, depthWrite:false}));
      heart.scale.set(.38,.38,1);
      parent.add(heart);
      return heart;
    });
    motion.push(t => {
      warning.position.y = 1.05 + Math.sin(t * 3) * .16;
      warning.rotation.y = t;
      stacks.forEach((sheet,i) => { sheet.position.y = .42 + (Math.sin(t * 1.1 + i) + 1) * .06; });
      employee.children[2].rotation.z = -.6 - Math.sin(t * 2) * .14;
      hearts.forEach((heart,i) => {
        const p = (t * .55 + i / 3) % 1;
        heart.position.set(.5 + Math.sin(p * 5 + i) * .24, .85 + p * 1.05, .7);
        heart.material.opacity = Math.min(1, (1 - p) * 3);
      });
    });
  } else if (paper.number === '05'){
    // Employee edits and manager-written fake reviews both pass through AI.
    person(parent, -.85, -.58, 'person');
    person(parent, -.85, .58, 'manager');
    paperSheet(parent, -.65, -.38);
    block(parent, -.65, .45, .57, .24, .06, .24, red);
    person(parent, 0, 0, 'llm');
    block(parent, .98, .73, 0, .55, 1.13, .09, 0x2d4952);
    block(parent, .98, .78, .055, .46, .86, .016, 0xecebdc);
    [0,1,2,3,4].forEach(i => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), mat(i < 4 ? red : 0xc6c3b7));
      dot.position.set(.81 + i * .085, 1.02, .075);
      parent.add(dot);
    });
    const signals = [pulse(parent, blue), pulse(parent, red), pulse(parent, blue, .065), pulse(parent, red, .065)];
    motion.push(t => {
      signals.forEach((signal,i) => {
        const p = (t * .43 + Math.floor(i / 2) * .5 + (i % 2) * .24) % 1;
        const lane = i % 2 ? .58 : -.58;
        signal.position.set(p < .5 ? -.75 + p * 1.5 : (p - .5) * 1.9,
          .8 + Math.sin(p * Math.PI) * .15,
          p < .5 ? lane * (1 - p * 2) : 0);
        signal.scale.setScalar(p < .5 ? 1 : .9);
      });
    });
  } else if (paper.number === '06'){
    // The assistance center and worker fade together, leaving the taxpayer without help.
    const center = new THREE.Group();
    center.position.x = .45;
    parent.add(center);
    block(center, 0, .46, 0, .85, .65, .82, blue);
    block(center, 0, .9, 0, 1.12, .12, 1.03, red);
    person(center, .52, -.2, 'irs');
    block(center, 0, .47, .43, .68, .5, .03, 0xb4b9b2);
    const fadingParts = [];
    center.traverse(part => {
      if (part.isMesh && part.material){
        part.material.transparent = true;
        part.material.depthWrite = false;
        fadingParts.push(part);
      }
    });
    const claimant = person(parent, -.65, .38, 'person');
    claimant.children[1].rotation.z = .9;
    claimant.children[2].rotation.z = -.9;
    paperSheet(parent, -.45, .8);
    const alarm = new THREE.Sprite(new THREE.SpriteMaterial({map:iconTexture('!', '#9b2737'), transparent:true}));
    alarm.scale.set(.32,.42,1);
    parent.add(alarm);
    motion.push(t => {
      const cycle = (t * .16) % 1;
      const visibility = cycle < .25 ? 1 : cycle < .5 ? 1 - (cycle - .25) * 4
        : cycle < .85 ? 0 : (cycle - .85) / .15;
      center.visible = visibility > .01;
      fadingParts.forEach(part => { part.material.opacity = visibility; });
      claimant.rotation.z = Math.sin(t * 7) * .08;
      alarm.position.set(-.65, 1.52 + Math.sin(t * 4) * .07, .38);
    });
  } else if (paper.number === '07'){
    // A published study reaches a sell-side analyst report.
    block(parent, 0, 1.38, -.75, 2.22, .95, .07, 0xece8d8);
    const prices = [[-1,1.02],[-.7,1.13],[-.48,1.07],[-.2,1.32],[.06,1.27],[.32,1.49],[.58,1.43],[.93,1.72]];
    const chart = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(prices.map(([x,y]) => new THREE.Vector3(x,y,-.7))),
      new THREE.LineBasicMaterial({color:0x7a1f2b, linewidth:3})
    );
    parent.add(chart);
    prices.forEach(([x,y]) => {
      const point = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4), mat(blue));
      point.position.set(x,y,-.68);
      parent.add(point);
    });
    block(parent, -.7, .36, 0, .72, .18, .82, red);
    block(parent, .7, .36, 0, .72, .18, .82, blue);
    person(parent, -.7, -.45, 'researcher');
    person(parent, .7, -.45, 'analyst');
    const sheet = paperSheet(parent, 0, .3);
    sheet.position.y = .58;
    motion.push(t => { sheet.position.x = Math.sin(t * .8) * .56; sheet.rotation.y = Math.sin(t * .8) * .22; });
  } else if (paper.number === '08'){
    // Repeated firm documents enter the model; a recommendation exits it.
    person(parent, -.05, -.28, 'llm');
    for (let i = 0; i < 5; i++){
      const x = -1.03 + i * .11;
      const z = -.32 + i * .08;
      const sheet = paperSheet(parent, x, z);
      sheet.position.y = .38 + i * .085;
      block(sheet, -.1, .045, -.11, .07, .01, .07, blue);
    }
    const firms = [-.3,.37].map((z, index) => block(parent, .83, .34, z, .47, .36, .37, index ? blue : red));
    const selection = new THREE.Mesh(new THREE.BoxGeometry(.55,.035,.45), mat(0x6c96b1));
    selection.position.set(.83, .55, .37);
    parent.add(selection);
    const inputs = [0,1,2].map(() => pulse(parent, blue, .065));
    const recommendation = pulse(parent, blue, .12);
    motion.push(t => {
      inputs.forEach((signal,i) => {
        const p = (t * .48 + i / 3) % 1;
        signal.position.set(-.72 + p * .63, .72 + Math.sin(p * Math.PI) * .12, -.12 - p * .16);
      });
      const progress = (t * .42) % 1;
      recommendation.position.set(.12 + progress * .7, .87 + Math.sin(progress * Math.PI) * .14,
        -.2 + progress * .57);
      selection.position.y = .55 + Math.sin(t * 2) * .035;
      firms[1].scale.y = 1 + Math.sin(t * 2) * .045;
    });
  }
  animatedScenes.push(t => motion.forEach(move => move(t)));
}

function addBeacon(paper){
  const group = new THREE.Group();
  group.position.set(paper.x, .06, paper.z);
  group.userData = paper;

  const sceneGroup = new THREE.Group();
  sceneGroup.scale.setScalar(1.25);
  group.add(sceneGroup);
  makePaperScene(paper, sceneGroup);

  world.add(group);
  paper.beacon = group;
}

paperData.forEach(addBeacon);

const pressed = new Set();
let started = false;
let speed = 0;
let steering = 0;
let activePaper = null;
const clock = new THREE.Clock();

function findPaperElement(number){
  return paperElements.find(paper => paper.querySelector('.paper-number')?.textContent.trim() === number);
}

function revealPaper(paper){
  const button = paper.minimapButton;
  if (button.classList.contains('is-discovered')) return;
  const title = findPaperElement(paper.number)?.querySelector('.paper-title')?.textContent.trim() ?? `Paper ${paper.number}`;
  button.classList.add('is-discovered');
  button.textContent = paper.number;
  button.title = title;
  button.setAttribute('aria-label', `Jump to paper ${paper.number}: ${title}`);
}

let encounterHideTimer;
function hidePaper(){
  if (encounter.hidden || encounter.classList.contains('is-leaving')) return;
  encounter.classList.add('is-leaving');
  encounterHideTimer = window.setTimeout(() => {
    encounter.hidden = true;
    encounter.classList.remove('is-leaving');
    delete map.dataset.paper;
    encounterHideTimer = null;
  }, 260);
}

function showPaper(paper){
  if (!paper) return;
  revealPaper(paper);
  if (activePaper === paper.number) return;
  activePaper = paper.number;
  window.clearTimeout(encounterHideTimer);
  encounterHideTimer = null;
  encounter.classList.remove('is-leaving');

  const source = findPaperElement(paper.number);
  if (!source) return;
  encounterNumber.textContent = paper.number;
  encounterTitle.textContent = source.querySelector('.paper-title')?.textContent.trim() ?? '';
  encounterMeta.textContent = source.querySelector('.paper-meta')?.textContent.trim() ?? '';
  const note = source.querySelector('.paper-note')?.textContent.trim() ?? '';
  encounterNote.textContent = note;
  encounterNote.hidden = !note;
  const links = source.querySelector('.paper-links');
  encounterLinks.innerHTML = links?.innerHTML ?? '';
  encounterLinks.hidden = !links;
  encounter.hidden = false;
  map.dataset.paper = paper.number;
}

document.querySelector('.encounter-close').addEventListener('click', () => {
  hidePaper();
});

function setPressed(key, isPressed){
  if (isPressed) pressed.add(key);
  else pressed.delete(key);
}

const keyMap = {
  KeyW:'forward', ArrowUp:'forward',
  KeyS:'backward', ArrowDown:'backward',
  KeyA:'left', ArrowLeft:'left',
  KeyD:'right', ArrowRight:'right',
  Space:'hover'
};

window.addEventListener('keydown', event => {
  if (allPapersDialog.open) return;
  const action = keyMap[event.code];
  if (!action) return;
  event.preventDefault();
  setPressed(action, true);
});

window.addEventListener('keyup', event => {
  const action = keyMap[event.code];
  if (action) setPressed(action, false);
});

window.addEventListener('blur', () => pressed.clear());

document.querySelectorAll('[data-move]').forEach(button => {
  const actionMap = {north:'forward', south:'backward', west:'left', east:'right'};
  const action = actionMap[button.dataset.move];
  const down = event => { event.preventDefault(); setPressed(action, true); };
  const up = () => setPressed(action, false);
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
});

const hoverButton = document.querySelector('[data-action="dash"]');
hoverButton.addEventListener('pointerdown', event => { event.preventDefault(); setPressed('hover', true); });
['pointerup','pointercancel','pointerleave'].forEach(type => hoverButton.addEventListener(type, () => setPressed('hover', false)));

const joystick = document.querySelector('.mobile-joystick');
const joystickThumb = joystick.querySelector('.mobile-joystick-thumb');
const stick = {x:0, y:0, pointerId:null};
function moveStick(event){
  const bounds = joystick.getBoundingClientRect();
  const radius = (joystick.clientWidth - joystickThumb.clientWidth) / 2;
  const dx = event.clientX - (bounds.left + bounds.width / 2);
  const dy = event.clientY - (bounds.top + bounds.height / 2);
  const scale = Math.min(1, radius / Math.max(radius, Math.hypot(dx, dy)));
  stick.x = dx * scale / radius;
  stick.y = dy * scale / radius;
  joystick.style.setProperty('--stick-x', `${dx * scale}px`);
  joystick.style.setProperty('--stick-y', `${dy * scale}px`);
}
function resetStick(){
  stick.x = stick.y = 0;
  stick.pointerId = null;
  joystick.style.setProperty('--stick-x', '0px');
  joystick.style.setProperty('--stick-y', '0px');
}
joystick.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (stick.pointerId !== null) return;
  stick.pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  moveStick(event);
});
joystick.addEventListener('pointermove', event => {
  if (event.pointerId === stick.pointerId) moveStick(event);
});
['pointerup','pointercancel','lostpointercapture'].forEach(type => joystick.addEventListener(type, event => {
  if (event.pointerId === stick.pointerId) resetStick();
}));

const mobileHover = document.querySelector('.mobile-hover');
let hoverPointerId = null;
mobileHover.addEventListener('pointerdown', event => {
  event.preventDefault();
  if (hoverPointerId !== null) return;
  hoverPointerId = event.pointerId;
  mobileHover.setPointerCapture(event.pointerId);
  mobileHover.classList.add('is-pressed');
  setPressed('hover', true);
});
['pointerup','pointercancel','lostpointercapture'].forEach(type => mobileHover.addEventListener(type, event => {
  if (event.pointerId !== hoverPointerId) return;
  hoverPointerId = null;
  mobileHover.classList.remove('is-pressed');
  setPressed('hover', false);
}));
[joystick,mobileHover].forEach(control => control.addEventListener('contextmenu', event => event.preventDefault()));
window.addEventListener('blur', () => {
  resetStick();
  hoverPointerId = null;
  mobileHover.classList.remove('is-pressed');
});

startButton.addEventListener('click', () => {
  started = true;
  map.classList.add('is-started');
  document.body.classList.add('is-started');
  renderer.domElement.focus();
});

if (new URLSearchParams(window.location.search).get('play') === '1') {
  started = true;
  map.classList.add('is-started');
  document.body.classList.add('is-started');
}

function updateRover(delta){
  if (!started || allPapersDialog.open) return;
  const stickStrength = Math.hypot(stick.x, stick.y);
  const usingStick = stick.pointerId !== null && stickStrength > .12;
  const hovering = pressed.has('hover');
  let onWater = !isOnIsland(rover.position.x / .975, rover.position.z / .975);
  const maxSpeed = onWater ? 4.8 : 7.2;
  const acceleration = onWater ? 6.5 : 10;

  if (usingStick){
    const screenX = stick.x / stickStrength;
    const screenY = stick.y / stickStrength;
    const targetAngle = Math.atan2(.793 * screenX + .61 * screenY,
      -.61 * screenX + .793 * screenY);
    const angleError = Math.atan2(Math.sin(targetAngle - rover.rotation.y),
      Math.cos(targetAngle - rover.rotation.y));
    const turnStep = THREE.MathUtils.clamp(angleError, -4.5 * delta, 4.5 * delta);
    rover.rotation.y += turnStep;
    steering = 0;
    const targetSpeed = maxSpeed * Math.min(1, stickStrength)
      * Math.max(0, Math.cos(angleError - turnStep));
    speed = THREE.MathUtils.lerp(speed, targetSpeed, 1 - Math.pow(.001, delta));
  } else {
    const direction = (pressed.has('forward') ? 1 : 0) - (pressed.has('backward') ? 1 : 0);
    const turn = (pressed.has('left') ? 1 : 0) - (pressed.has('right') ? 1 : 0);
    if (direction) speed += direction * acceleration * delta;
    else speed *= Math.pow(onWater ? .12 : .04, delta);
    speed = THREE.MathUtils.clamp(speed, onWater ? -2.8 : -4.2, maxSpeed);
    const turnStrength = THREE.MathUtils.clamp(Math.abs(speed) / 5, .15, 1);
    steering = THREE.MathUtils.lerp(steering, turn * 1.7 * turnStrength, 1 - Math.pow(.001, delta));
    rover.rotation.y += steering * delta * (speed >= 0 ? 1 : -1);
  }

  const previousPosition = rover.position.clone();
  rover.position.x += Math.sin(rover.rotation.y) * speed * delta;
  rover.position.z += Math.cos(rover.rotation.y) * speed * delta;
  const reachedEdge = Math.abs(rover.position.x) > 26 || Math.abs(rover.position.z) > 18;
  rover.position.x = THREE.MathUtils.clamp(rover.position.x, -26, 26);
  rover.position.z = THREE.MathUtils.clamp(rover.position.z, -18, 18);
  if (reachedEdge) speed = 0;
  onWater = !isOnIsland(rover.position.x / .975, rover.position.z / .975);
  const treeCollision = collisionObstacles.some(obstacle => (
    Math.hypot(rover.position.x - obstacle.x, rover.position.z - obstacle.z) < obstacle.radius + .62
  ));
  if (!onWater && rover.position.y < .8 && treeCollision){
    rover.position.x = previousPosition.x;
    rover.position.z = previousPosition.z;
    speed *= -.16;
    onWater = !isOnIsland(rover.position.x / .975, rover.position.z / .975);
  }
  const baseY = onWater ? -.28 : .02;
  const targetY = hovering ? (onWater ? 2.0 : 2.25)
    : baseY + (onWater ? Math.sin(clock.elapsedTime * 2.7) * .035 : 0);
  rover.position.y = THREE.MathUtils.lerp(rover.position.y, targetY,
    1 - Math.pow(.015, delta));
  const lift = rover.position.y - baseY;
  waterline.visible = onWater && !hovering && lift < .3;
  if (waterline.visible){
    waterline.position.x = rover.position.x;
    waterline.position.z = rover.position.z;
    const ripple = Math.sin(clock.elapsedTime * 2.2) * .05;
    waterline.scale.set(1.1 + ripple, 1.65 + ripple, 1);
  }
  hoverJets.forEach((jet, index) => {
    const active = hovering || lift > .25;
    jet.outer.visible = active;
    jet.core.visible = active;
    jet.particles.forEach(particle => { particle.visible = active; });
    jet.splash.visible = active && onWater && lift > .25;
    if (!active) return;
    const length = Math.max(.1, (rover.position.y - (onWater ? -.28 : 0)) / .82 - .05);
    const strength = Math.min(1, lift / 1.3);
    jet.outer.scale.y = length;
    jet.outer.position.set(jet.x, .02 - length / 2, jet.z);
    jet.core.scale.y = length * .95;
    jet.core.position.set(jet.x, .02 - length * .475, jet.z);
    jet.outer.material.opacity = .42 * strength * (.84 + .16 * Math.sin(clock.elapsedTime * 15 + index));
    jet.core.material.opacity = .75 * strength * (.9 + .1 * Math.sin(clock.elapsedTime * 18 + index));
    jet.particles.forEach((particle, particleIndex) => {
      const progress = (clock.elapsedTime * 3.1 + particleIndex / 3 + index * .13) % 1;
      particle.position.set(jet.x + Math.sin(progress * 13 + index) * .035,
        .02 - progress * length, jet.z + Math.cos(progress * 11 + index) * .035);
      particle.scale.setScalar(.6 + progress * .65);
      particle.material.opacity = .8 * strength * (1 - progress * .65);
    });
    if (jet.splash.visible){
      const sine = Math.sin(rover.rotation.y);
      const cosine = Math.cos(rover.rotation.y);
      jet.splash.position.x = rover.position.x + .82 * (cosine * jet.x + sine * jet.z);
      jet.splash.position.z = rover.position.z + .82 * (-sine * jet.x + cosine * jet.z);
      const wave = (clock.elapsedTime * 2.7 + index * .23) % 1;
      jet.splash.scale.setScalar(.8 + wave * 1.6);
      jet.splash.material.opacity = .48 * strength * (1 - wave);
    }
  });
  wakeTimer += delta;
  if (onWater && !hovering && Math.abs(speed) > .35 && wakeTimer > .18){
    wakeTimer = 0;
    const wake = wakes.find(item => item.age >= 1.3) ?? wakes.reduce((oldest, item) => item.age > oldest.age ? item : oldest);
    wake.age = 0;
    wake.mesh.visible = true;
    wake.mesh.position.x = rover.position.x - Math.sin(rover.rotation.y) * .8;
    wake.mesh.position.z = rover.position.z - Math.cos(rover.rotation.y) * .8;
  }
  wakes.forEach(wake => {
    wake.age += delta;
    wake.mesh.visible = wake.age < 1.3;
    if (wake.mesh.visible){
      wake.mesh.scale.setScalar(1 + wake.age * 1.8);
      wake.mesh.material.opacity = .35 * (1 - wake.age / 1.3);
    }
  });
  container.dataset.roverX = rover.position.x.toFixed(2);
  container.dataset.roverZ = rover.position.z.toFixed(2);
  container.dataset.speed = speed.toFixed(2);
  container.dataset.airborne = rover.position.y > .8 ? 'true' : 'false';
  container.dataset.water = onWater ? 'true' : 'false';
  minimapCar.style.left = mapPercent(rover.position.x, 27);
  minimapCar.style.top = mapPercent(rover.position.z, 19);
  minimapCar.style.setProperty('--car-angle', `${rover.rotation.y}rad`);

  animatedScenes.forEach(update => update(clock.elapsedTime));

  const nearest = paperData
    .map(paper => ({paper, distance:Math.hypot(rover.position.x - paper.x, rover.position.z - paper.z)}))
    .sort((a,b) => a.distance - b.distance)[0];
  if (nearest.distance < 2.15) showPaper(nearest.paper);
  else if (activePaper && Math.hypot(
    rover.position.x - paperData.find(paper => paper.number === activePaper).x,
    rover.position.z - paperData.find(paper => paper.number === activePaper).z
  ) > 3.2){
    activePaper = null;
    hidePaper();
  }
}

function updateCamera(delta){
  const desired = new THREE.Vector3(rover.position.x + 10, 15, rover.position.z + 13);
  camera.position.lerp(desired, 1 - Math.pow(.02, delta));
  const lookTarget = new THREE.Vector3(rover.position.x, 0, rover.position.z);
  camera.lookAt(lookTarget);
}

function resize(){
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const viewHeight = 16;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(container);
resize();

function animate(){
  const delta = Math.min(clock.getDelta(), .05);
  updateRover(delta);
  updateCamera(delta);
  glints.forEach(({mesh, phase, x}) => {
    mesh.material.opacity = .1 + .09 * (1 + Math.sin(clock.elapsedTime * .75 + phase)) / 2;
    mesh.position.x = x + Math.sin(clock.elapsedTime * .45 + phase) * .06;
  });
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
