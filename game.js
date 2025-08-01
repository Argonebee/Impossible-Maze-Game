
const MAZE_IMAGE_SRC = "maze.png";

// How many milliseconds to show reset message
const RESET_DURATION = 1000;
// How many milliseconds to show win message
const WIN_DURATION = 1000;

// Maze movement speed scaling (adjust for feel)
// Read from localStorage, fallback to 1.0
function getMouseSensitivity() {
  const val = localStorage.getItem('mazeSensitivity');
  const parsed = parseFloat(val);
  return (!isNaN(parsed) && parsed > 0) ? parsed : 1.0;
}
let MOUSE_SENSITIVITY = getMouseSensitivity();

const canvas = document.getElementById('maze-canvas');
if (!canvas) {
  throw new Error("Element with id 'maze-canvas' not found.");
}
const ctx = canvas.getContext('2d');
const resetMessage = document.getElementById('reset-message');
if (!resetMessage) {
  throw new Error("Element with id 'reset-message' not found.");
}
const gameMusic = document.getElementById('game-music');
// Apply saved volume from homepage
const savedVolume = localStorage.getItem('mazeVolume');
if (gameMusic && typeof gameMusic.volume === "number") {
  gameMusic.volume = savedVolume !== null && !isNaN(parseFloat(savedVolume)) ? parseFloat(savedVolume) : 0.6;
}

let mazeImg = new Image();
let mazeLoaded = false;
let mazeWidth = 0, mazeHeight = 0;

// Maze offset (top-left in canvas)
let mazeOffset = { x: 0, y: 0 };
// When game resets, store maze at center
let mazeOffsetStart = { x: 0, y: 0 };

// To prevent rapid resets
let resetting = false;
let winning = false;
let winTimeout = null;
let jokeTimeout = null;

// For pointer lock
function pointerLockSupported() {
  return 'pointerLockElement' in document ||
         'webkitPointerLockElement' in document ||
         'mozPointerLockElement' in document;
}

// Set canvas to fill window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Recenter maze on resize
  if (mazeLoaded) {
    mazeOffsetStart = {
      x: (canvas.width - mazeWidth) / 2,
      y: (canvas.height - mazeHeight) / 2
    };
    mazeOffset = { ...mazeOffsetStart };
    drawMaze();
  }
}
window.addEventListener('resize', resizeCanvas);

// Draw maze at current offset
function drawMaze() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mazeLoaded) {
    ctx.drawImage(mazeImg, mazeOffset.x, mazeOffset.y, mazeWidth, mazeHeight);
  }
}

// Get color at center of screen (where cursor is fixed)
function getCenterPixel() {
  if (!mazeLoaded) return null;
  // Center pixel in canvas
  const cx = Math.floor(canvas.width / 2);
  const cy = Math.floor(canvas.height / 2);
  // Convert to maze image coordinates
  const mx = cx - mazeOffset.x;
  const my = cy - mazeOffset.y;
  if (mx < 0 || my < 0 || mx >= mazeWidth || my >= mazeHeight) {
    // Out of maze bounds, treat as wall
    return null;
  }
  // Create a temp canvas to read pixel from maze
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = mazeWidth;
  tmpCanvas.height = mazeHeight;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(mazeImg, 0, 0, mazeWidth, mazeHeight);
  const pixel = tmpCtx.getImageData(mx, my, 1, 1).data;
  return pixel;
}

// Collision with black wall
function isCenterOnWall() {
  const pixel = getCenterPixel();
  if (!pixel) return true;
  // Black wall: R,G,B all near zero, and A not zero
  return (pixel[3] > 32) && (pixel[0] < 32 && pixel[1] < 32 && pixel[2] < 32);
}

// Collision with red border
function isCenterOnRedBorder() {
  const pixel = getCenterPixel();
  if (!pixel) return false;
  // Red border: R high, G/B low, A not zero
  return (pixel[3] > 32) && (pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50);
}

function resetGame() {
  resetting = true;
  // 🔊 Play the lose sound
  const loseSound = document.getElementById('lose-sound');
  if (loseSound && typeof loseSound.play === "function") {
    loseSound.currentTime = 0; // rewind to start
    loseSound.play().catch(() => {});
  }
  // Center maze again
  mazeOffset = { ...mazeOffsetStart };
  drawMaze();
  // Show reset message
  resetMessage.style.display = "block";
  resetMessage.innerText = "YOU LOST! LOL NOOB!";
  setTimeout(() => {
    resetMessage.style.display = "none";
    resetting = false;
  }, RESET_DURATION);
}

// Win function
function winGame() {
  winning = true;
  resetMessage.style.display = "block";
  resetMessage.innerText = "YOU WIN !";
  // Lock out all input and timer-based event for 1 seconds
  winTimeout = setTimeout(() => {
    // Change message
    resetMessage.innerText = "NOPE JUST KIDDING YOU LOST! LOL!";
    jokeTimeout = setTimeout(() => {
      resetMessage.style.display = "none";
      winning = false;
      // Optionally, could reset game here
      resetGame();
    }, 1000);
  }, WIN_DURATION);
}

// Mouse move handler (relative movement)
function onPointerMove(e) {
  if (!mazeLoaded || resetting || winning) return;
  // Get latest sensitivity in case user changed it on home page while game is open in new window/tab
  MOUSE_SENSITIVITY = getMouseSensitivity();
  // e.movementX/Y is relative mouse movement since last event
  mazeOffset.x -= e.movementX * MOUSE_SENSITIVITY;
  mazeOffset.y -= e.movementY * MOUSE_SENSITIVITY;
  drawMaze();
  // Collision check
  if (isCenterOnWall()) {
    resetGame();
  } else if (isCenterOnRedBorder()) {
    winGame();
  }
}

// Request pointer lock on click
if (canvas) {
  canvas.addEventListener('click', function() {
    if (pointerLockSupported()) {
      canvas.requestPointerLock = canvas.requestPointerLock || 
                                 canvas.mozRequestPointerLock ||
                                 canvas.webkitRequestPointerLock;
      if (typeof canvas.requestPointerLock === "function") {
        canvas.requestPointerLock();
      }
    }
  });
}

// Listen for pointer lock change
function pointerLockChange() {
  if (document.pointerLockElement === canvas ||
      document.mozPointerLockElement === canvas ||
      document.webkitPointerLockElement === canvas) {
    document.addEventListener("mousemove", onPointerMove, false);
  } else {
    document.removeEventListener("mousemove", onPointerMove, false);
  }
}
document.addEventListener('pointerlockchange', pointerLockChange, false);
document.addEventListener('mozpointerlockchange', pointerLockChange, false);
document.addEventListener('webkitpointerlockchange', pointerLockChange, false);

// Load maze image
mazeImg.onload = function() {
  mazeLoaded = true;
  mazeWidth = mazeImg.width;
  mazeHeight = mazeImg.height;
  resizeCanvas();
  drawMaze();
};
mazeImg.src = MAZE_IMAGE_SRC;

// On load, set up everything
window.onload = function() {
  resizeCanvas();
  // Show instructions if pointer lock not supported
  if (!pointerLockSupported()) {
    alert("Your browser does not support pointer lock. Try Chrome or Firefox.");
  }
};