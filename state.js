// ==========================================
// 2. STATE: GLOBÁLNÍ PROMĚNNÉ A STAV
// ==========================================
const canvas = document.getElementById('blueprintCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const loopSelect = document.getElementById('loopSelect');

const textModal = document.getElementById('textModal'); 
const devTextInput = document.getElementById('devTextInput');
const mainMenuModal = document.getElementById('mainMenuModal'); 
const saveModal = document.getElementById('saveModal');

let floors = [];
let customDeviceIcons = {};
let currentFloorIndex = -1;
let selectedTool = 'pir'; 

let scale = 1; let offsetX = 0; let offsetY = 0;
let isPanning = false; let startPanX = 0; let startPanY = 0;

let draggedDevice = null; let draggedHandle = null; let isDragging = false;
let isExporting = false; 

let showDeactivatedDevices = true;
let isOverviewMode = false;

let clickStartX = 0; let clickStartY = 0;
let clickTimer = null; let lastClickedDevice = null;
let isClickingText = false; let clickedCableId = null;
let activeDeviceIds = new Set();
let isSelecting = false; let selStartX = 0, selStartY = 0, selEndX = 0, selEndY = 0;
let clipboardDevices = []; let lastMouseX = 0; let lastMouseY = 0;
let pointerCanvasX = null; let pointerCanvasY = null;

let snapGuideX = null; let snapGuideY = null;
let currentFileHandle = null;
let isSystemReady = false; 

let historyStack = [];
let historyIndex = -1;

let db;
let autoSaveTimer = null;
let currentMaxLines = 10;
let editingDevice = null;

let globalTime = 0;
let lastRenderTime = 0;

let projectName = "Nový projekt";