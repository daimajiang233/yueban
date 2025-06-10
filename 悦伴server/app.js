const WebSocket = require('ws');

// 自定义短 ID 生成器
function generateShortId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  // 生成 2 位随机字母
  const letterPart = Array(2)
    .fill()
    .map(() => letters.charAt(Math.floor(Math.random() * letters.length)))
    .join('');
  // 生成 4 位随机数字
  const numberPart = Array(4)
    .fill()
    .map(() => numbers.charAt(Math.floor(Math.random() * numbers.length)))
    .join('');
  return letterPart + numberPart; // 形如 YM0527
}

const wss = new WebSocket.Server({ port: 3000 });
const rooms = new Map(); // 存储房间信息 {roomId: [ws1, ws2]}
const roomTimeouts = new Map(); // 存储房间的关闭定时器

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid JSON format' 
      }));
      return;
    }

    if (data.type === 'create') {
      // 创建房间
      let roomId;
      do {
        roomId = generateShortId(); // 使用短 ID
      } while (rooms.has(roomId)); // 确保 ID 唯一
      rooms.set(roomId, [ws]);
      ws.roomId = roomId;
      ws.send(JSON.stringify({ 
        type: 'roomCreated', 
        message: 'Room created successfully', 
        roomId 
      }));
      console.log(`Room ${roomId} created`);
    } else if (data.type === 'join') {
      // 加入房间
      const { roomId } = data;
      if (!rooms.has(roomId)) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room does not exist or has expired' 
        }));
        return;
      }
      const room = rooms.get(roomId);
    //   限制房间最大人数
      if (room.length >= 2000) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room is full' 
        }));
        return;
      }
      // 清除房间的关闭定时器（如果存在）
      if (roomTimeouts.has(roomId)) {
        clearTimeout(roomTimeouts.get(roomId));
        roomTimeouts.delete(roomId);
        console.log(`Cancelled timeout for room ${roomId}`);
      }
      room.push(ws);
      ws.roomId = roomId;
      ws.send(JSON.stringify({ 
        type: 'joined', 
        message: 'Joined room successfully', 
        roomId 
      }));
      // 通知房间内其他用户
      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'userJoined', 
            message: 'Another user has joined the room' 
          }));
        }
      });
      console.log(`User joined room ${roomId}`);
    } else if (data.type === 'checkRoom') {
      // 检查房间是否存在
      const { roomId } = data;
      if (!roomId) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room ID is required' 
        }));
        return;
      }
      if (rooms.has(roomId)) {
        ws.send(JSON.stringify({ 
          type: 'roomStatus', 
          message: 'Room exists', 
          roomId 
        }));
      } else {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room does not exist or has expired' 
        }));
      }
      console.log(`Checked room ${roomId}: ${rooms.has(roomId) ? 'exists' : 'does not exist or expired'}`);
    } else if (data.type === 'data') {
      // 同步数据
      const room = rooms.get(ws.roomId);
      if (room) {
        room.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'data', 
              message: 'New data received', 
              payload: data.payload 
            }));
          }
        });
      } else {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Not in a room' 
        }));
      }
    } else {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Unknown message type' 
      }));
    }
  });

  ws.on('close', () => {
    // 用户断开连接，清理房间
    if (ws.roomId) {
      const room = rooms.get(ws.roomId);
      if (room) {
        const updatedRoom = room.filter((client) => client !== ws);
        if (updatedRoom.length === 0) {
          // 房间为空，设置 1 分钟后关闭
          const timeoutId = setTimeout(() => {
            rooms.delete(ws.roomId);
            roomTimeouts.delete(ws.roomId);
            console.log(`Room ${ws.roomId} deleted after 1 minute of being empty`);
          }, 60 * 1000); // 60秒
          roomTimeouts.set(ws.roomId, timeoutId);
          console.log(`Room ${ws.roomId} is empty, will close in 1 minute`);
          rooms.set(ws.roomId, updatedRoom);
        } else {
          // 房间还有用户，更新房间并通知
          rooms.set(ws.roomId, updatedRoom);
          updatedRoom.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ 
                type: 'userLeft', 
                message: 'A user has left the room' 
              }));
            }
          });
        }
      }
    }
  });
});

console.log('WebSocket server running on ws://localhost:3000');