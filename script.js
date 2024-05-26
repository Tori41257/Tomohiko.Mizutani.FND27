//Toio技術仕様
// 仕様： https://toio.github.io/toio-spec/docs/ble_communication_overview
// 仕様： https://toio.github.io/toio-spec/docs/ble_light
// 仕様： https://toio.github.io/toio-spec/docs/ble_motor

// toio の LED やモーターを制御するための命令用
const cube1 = {
  device: undefined,
  sever: undefined,
  service: undefined,
  motorChar: undefined,
  lightChar: undefined,
  positionChar: undefined,
};

// BLE通信用 UUID
const TOIO_SERVICE_UUID = '10b20100-5b3b-4571-9508-cf3efcd7bbae';
const LIGHT_CHARCTERISTICS_UUID = '10b20103-5b3b-4571-9508-cf3efcd7bbae';
const MOTOR_CHARCTERISTICS_UUID = '10b20102-5b3b-4571-9508-cf3efcd7bbae';
const POSITION_CHARACTERISTIC_UUID = '10b20101-5b3b-4571-9508-cf3efcd7bbae';

// toio の LED やモーターを制御するための命令用データ宣言
//記述例
// const motor_buf_01 = new Uint8Array([
//   0x03,  // 0  コマンドID（0x03は目標指定付きモーター制御）
//   0x00,  // 1  制御識別値
//   0x05,  // 2  タイムアウト時間(秒)
//   0x02,  // 3  移動タイプ 0:回転しながら移動 1:回転しながら移動（後退なし） 2:回転してから移動
//   0x20,  // 4  目標地点のX座標（リトルエンディアンで低バイト先、0x0020）
//   0x03,  // 5  モーターの速度変化タイプ  0:速度一定 1:目標地点まで徐々に加速 2:目標地点まで徐々に減速 3:中間地点まで徐々に加速し、そこから目標地点まで減速
//   0x00,  // 6  Reserved
//   0xf5,  // 7  目標地点のX座標（リトルエンディアンで低バイト先、0x00f5）
//   0x00,  // 8   Reserved
//   0xf5,  // 9  標地点のY座標（リトルエンディアンで低バイト先、0x00f5）
//   0x00,  // 10  Reserved
//   0x5a,  // 11 目標地点でのキューブの角度 Θ	 0x5a=90度
//   0x00   // 12  Reserved
// ]);
// 16進数との変換表メモ
//   0:0x00  10:0x0A  20:0x14  30:0x1E  40:0x28
//  50:0x32  60:0x3C  70:0x46  80:0x50  90:0x5A
// 100:0x6E  120:0x78  140:0x8C  160:0xA0  180:0xB4
// 200:0xC8  220:0xDC  240:0xF0  255:0xFF
const motor_moveForword = new Uint8Array([0x02, 0x01, 0x01, 0x14, 0x02, 0x01, 0x14, 0x32]); 
const motor_turnRight = new Uint8Array([0x02, 0x01, 0x01, 0x14, 0x02, 0x02, 0x14, 0x24]);
const motor_turnLeft = new Uint8Array([0x02, 0x01, 0x02, 0x14, 0x02, 0x01, 0x14, 0x24]);
const motor_moveBack = new Uint8Array([0x02, 0x01, 0x02, 0x14, 0x02, 0x02, 0x14, 0x32]);
const motor_moveAttack = new Uint8Array([0x02, 0x01, 0x01, 0x32, 0x02, 0x01, 0x32, 0x32]);


//ToioとのBluetooth接続用関数
async function connectCube(cube) {
  // スキャンオプション
  const options = {
    filters: [
      { services: [TOIO_SERVICE_UUID] }
    ],
  };
  navigator.bluetooth.requestDevice(options)
    .then(device => {
      cube.device = device;
      addMessageToBox("接続完了！");
      return device.gatt.connect();
    })
    .then(server => {
      cube.server = server;
      return server.getPrimaryService(TOIO_SERVICE_UUID);
    })
    .then(service => {
      cube.service = service;
      return cube.service.getCharacteristic(LIGHT_CHARCTERISTICS_UUID);
    })
    .then(characteristic => {
      cube.lightChar = characteristic;
      return cube.service.getCharacteristic(MOTOR_CHARCTERISTICS_UUID);
    })
    .then(characteristic => {
      cube.motorChar = characteristic;
      return cube.service.getCharacteristic(POSITION_CHARACTERISTIC_UUID);
    })
    .then(characteristic => {
      cube.positionChar = characteristic;
      startPositionReading(cube.positionChar);
    })
    .catch(error => {
      console.log(error);
    });
}

function disconnectCube(cube) {
  if (!cube.device || !cube.device.gatt.connected) return;
  cube.device.gatt.disconnect();
}

function controlLight(cube, buf) {
  if ((cube !== undefined) && (cube.lightChar !== undefined)) {
    cube.lightChar.writeValue(buf);
  }
}
function controlMotor(cube, buf) {
  if ((cube !== undefined) && (cube.motorChar !== undefined)) {
    cube.motorChar.writeValue(buf);
  }
}

// 位置情報の読み取りを開始するオリジナル関数
function startPositionReading(characteristic) {
  const statusDiv = document.getElementById('status');
  setInterval(async () => {
    const value = await characteristic.readValue();
    const position = parsePosition(value);
    statusDiv.innerHTML = `Coordinate<br>X: ${position.x}, Y: ${position.y}, Angle: ${position.angle}`;
  }, 500);
}

// 位置情報のパース用関数
function parsePosition(value) {
  if (value.byteLength < 7) { // 期待されるバイト長を確認
    throw new RangeError("DataView length is less than expected.");
  }
  return {
    x: value.getUint16(1, true),
    y: value.getUint16(3, true),
    angle: value.getUint16(5, true)
  };
}

function addMessageToBox(message) {
  var messageBox = document.querySelector(".message-box");
  messageBox.innerHTML += message + "<br>"; // メッセージを追加
  messageBox.scrollTop = messageBox.scrollHeight; // スクロールを最下部に移動
}

// ダメージエフェクト関数
function shakeImage() {
  const img = document.getElementById('webcamImage');
  const overlay = document.getElementById('overlayShake');
  const originalStyle = img.style.cssText;
  let shakes = 10; // 揺れる回数
  let interval = 50; // 揺れる間隔 (ミリ秒)

  overlay.style.display = 'block'; // オーバーレイを表示

  function shake() {
    const x = Math.random() * 50 - 5; // ランダムなX方向の揺れ
    const y = Math.random() * 50 - 5; // ランダムなY方向の揺れ
    img.style.transform = `translate(${x}px, ${y}px)`;

    shakes--;

    if (shakes > 0) {
      setTimeout(shake, interval);
    } else {
      img.style.cssText = originalStyle; // 元の位置に戻す
      overlay.style.display = 'none'; // オーバーレイを非表示
    }
  }
  shake();
}

// デモ画像とWEBカメラ画像を切り替える関数
function toggleImage() {
  const img = document.getElementById('webcamImage');
  if (img.src.includes('api/v1/stream')) {
    img.src = 'images/demo_image.png'; // 代替画像のパス
  } else {
    img.src = 'http://192.168.4.1/api/v1/stream'; // 元の画像のパス
  }
}

 // 説明書を表示する関数
 function showManual() {
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex'; // オーバーレイを表示
}

// オーバーレイ(説明書)をクリックすると非表示にする
document.getElementById('overlay').addEventListener('click', function () {
  this.style.display = 'none';
});

//Webページ上のボタンと処理の紐付け
document.getElementById("connect1").addEventListener("click", function () { connectCube(cube1) }, false);
document.getElementById("disconnect1").addEventListener("click", function () { disconnectCube(cube1) }, false);

let countMove = 0; // moveForward ボタンのクリック数をカウントする変数

document.getElementById("moveForward").addEventListener("click", function () {
  countMove++; // ボタンがクリックされるたびにカウントを1増やす
  addMessageToBox("前に一歩進んだ！ <" + countMove + " 歩>"); // メッセージに回数を追加
  controlMotor(cube1, motor_moveForword); // モーターを制御する関数を呼び出し
}, false);

document.getElementById("moveBack").addEventListener("click", function () {
  countMove++; // ボタンがクリックされるたびにカウントを1増やす
  addMessageToBox("後ろに一歩進んだ！ <" + countMove + " 歩>"); // メッセージに回数を追加
  controlMotor(cube1, motor_moveBack); // モーターを制御する関数を呼び出し
}, false);

document.getElementById("turnRight").addEventListener("click", function () {
  countMove++; // ボタンがクリックされるたびにカウントを1増やす
  addMessageToBox("右を向いた！ <" + countMove + " 歩>"); // メッセージに回数を追加
  controlMotor(cube1, motor_turnRight); // モーターを制御する関数を呼び出し
}, false);

document.getElementById("turnLeft").addEventListener("click", function () {
  countMove++; // ボタンがクリックされるたびにカウントを1増やす
  addMessageToBox("左を向いた！ <" + countMove + " 歩>"); // メッセージに回数を追加
  controlMotor(cube1, motor_turnLeft); // モーターを制御する関数を呼び出し
}, false);

document.getElementById("centerAction").addEventListener("click", function () {
  addMessageToBox("攻撃！"); // メッセージに回数を追加
  controlMotor(cube1, motor_moveAttack); // モーターを制御する関数を呼び出し
  const img = document.getElementById('webcamImage');
  const overlay = document.getElementById('overlayShake');
  const originalStyle = img.style.cssText;
  let shakes = 10; // 揺れる回数
  let interval = 50; // 揺れる間隔 (ミリ秒)

  overlay.style.display = 'block'; // オーバーレイを表示

  function shake() {
    const x = Math.random() * 50 - 5; // ランダムなX方向の揺れ
    const y = Math.random() * 50 - 5; // ランダムなY方向の揺れ
    img.style.transform = `translate(${x}px, ${y}px)`;

    shakes--;

    if (shakes > 0) {
      setTimeout(shake, interval);
    } else {
      img.style.cssText = originalStyle; // 元の位置に戻す
      overlay.style.display = 'none'; // オーバーレイを非表示
    }
  }
  shake();
}, false);

document.getElementById('shakeButton').addEventListener('click', shakeImage);
document.getElementById('toggleImage').addEventListener('click', toggleImage);
document.getElementById('showManual').addEventListener('click', showManual);