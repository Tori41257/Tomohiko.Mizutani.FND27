// GitHub Pages で試すための URL ⇒ https://yo-to.github.io/API_Test/WebAPI/test10_test09_and_AudioRecognition/test02_c.html
// 情報元1： https://qiita.com/tetunori_lego/items/0670587c06fa9e9faf52
//          https://github.com/tetunori/MechanumWheelControlWebBluetooth
// 情報元2： https://app.codegrid.net/entry/2016-web-speech-api-1
// 情報元3： https://qiita.com/belq/items/10ec41f656e47ee2b540
// 情報元4： http://jellyware.jp/kurage/bluejelly/multiple_connections.html

let count = 0;
let indexMax = -1;

// toio のモーターの仕様： https://toio.github.io/toio-spec/docs/ble_motor
const motor_buf_01 = new Uint8Array([
  0x03,  // 0  コマンドID（0x03は目標指定付きモーター制御）
  0x00,  // 1  制御識別値
  0x05,  // 2  タイムアウト時間(秒)
  0x02,  // 3  移動タイプ 0:回転しながら移動 1:回転しながら移動（後退なし） 2:回転してから移動
  0x20,  // 4  目標地点のX座標（リトルエンディアンで低バイト先、0x0020）
  0x03,  // 5  モーターの速度変化タイプ  0:速度一定 1:目標地点まで徐々に加速 2:目標地点まで徐々に減速 3:中間地点まで徐々に加速し、そこから目標地点まで減速
  0x00,  // 6  Reserved
  0xf5,  // 7  目標地点のX座標（リトルエンディアンで低バイト先、0x00f5）
  0x00,  // 8   Reserved
  0xf5,  // 9  標地点のY座標（リトルエンディアンで低バイト先、0x00f5）
  0x00,  // 10  Reserved
  0x5a,  // 11 目標地点でのキューブの角度 Θ	 0x5a=90度
  0x00   // 12  Reserved
]);
// 16進数との変換表メモ  http://www16.plala.or.jp/fm677/16hex.htm
//   0:0x00  10:0x0A  20:0x14  30:0x1E  40:0x28
//  50:0x32  60:0x3C  70:0x46  80:0x50  90:0x5A
// 100:0x6E  120:0x78  140:0x8C  160:0xA0  180:0xB4
// 200:0xC8  220:0xDC  240:0xF0  255:0xFF

const cube1 = {
  device: undefined,
  sever: undefined,
  service: undefined,
  motorChar: undefined,
  lightChar: undefined
};

// toio の LED やモーターを制御するための命令用
const light_buf1 = new Uint8Array([0x03, 0x00, 0x01, 0x01, 0x00, 0xFF, 0x00]); // 仕様： https://toio.github.io/toio-spec/docs/ble_light
const light_buf2 = new Uint8Array([0x03, 0x00, 0x01, 0x01, 0x00, 0x00, 0xFF]);
const motor_moveForword = new Uint8Array([0x02, 0x01, 0x01, 0x32, 0x02, 0x01, 0x32, 0x10]); // 仕様： https://toio.github.io/toio-spec/docs/ble_motor
const motor_turnRight   = new Uint8Array([0x02, 0x01, 0x01, 0x32, 0x02, 0x02, 0x32, 0x0D]);
const motor_turnLeft= new Uint8Array([0x02, 0x01, 0x02, 0x32, 0x02, 0x01, 0x32, 0x0D]); // 仕様： https://toio.github.io/toio-spec/docs/ble_motor
const motor_moveBack = new Uint8Array([0x02, 0x01, 0x02, 0x32, 0x02, 0x02, 0x32, 0x10]); // 仕様： https://toio.github.io/toio-spec/docs/ble_motor


// ここからWebページ上のボタンと処理の紐付け
const connect1 = document.getElementById("connect1");
const disconnect1 = document.getElementById("disconnect1");
const light1 = document.getElementById("light1");
const motor1 = document.getElementById("motor1");

connect1.addEventListener("click", function () { connectCube(cube1) }, false);
disconnect1.addEventListener("click", function () { disconnectCube(cube1) }, false);
light1.addEventListener("click", function () { controlLight(cube1, light_buf1) }, false);
motor1.addEventListener("click", function () { controlMotor(cube1, motor_moveForword) }, false);

// BLE通信用
const TOIO_SERVICE_UUID = '10b20100-5b3b-4571-9508-cf3efcd7bbae'; // 仕様： https://toio.github.io/toio-spec/docs/ble_communication_overview
const LIGHT_CHARCTERISTICS_UUID = '10b20103-5b3b-4571-9508-cf3efcd7bbae'; // 仕様： https://toio.github.io/toio-spec/docs/ble_light
const MOTOR_CHARCTERISTICS_UUID = '10b20102-5b3b-4571-9508-cf3efcd7bbae'; // 仕様： https://toio.github.io/toio-spec/docs/ble_motor
// Toioの位置情報を取得するためのUUID
const POSITION_SERVICE_UUID = '10b20100-5b3b-4571-9508-cf3efcd7bbae';
const POSITION_CHARACTERISTIC_UUID = '10b20101-5b3b-4571-9508-cf3efcd7bbae';

// 情報元1の内容、ほぼそのまま
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

// 位置情報の読み取りを開始する関数
function startPositionReading(characteristic) {
  const statusDiv = document.getElementById('status');
  setInterval(async () => {
    const value = await characteristic.readValue();
    const position = parsePosition(value);
    statusDiv.innerHTML = `Coordinate<br>X: ${position.x}, Y: ${position.y}, Angle: ${position.angle}`;
  }, 500);
}

// 位置情報のパース関数
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


// toio を動かす部分は、処理の都合で音声合成をコメントアウト
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

function disconnectCube(cube) {
  if (!cube.device || !cube.device.gatt.connected) return;
  cube.device.gatt.disconnect();
}

function addMessageToBox(message) {
  var messageBox = document.querySelector(".message-box");
  messageBox.innerHTML += message + "<br>"; // メッセージを追加
  messageBox.scrollTop = messageBox.scrollHeight; // スクロールを最下部に移動
}


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


document.getElementById("turnLeft").addEventListener("click", function () {
  countMove++; // ボタンがクリックされるたびにカウントを1増やす
  addMessageToBox("左を向いた！ <" + countMove + " 歩>"); // メッセージに回数を追加
  controlMotor(cube1, motor_turnLeft); // モーターを制御する関数を呼び出し
}, false);
