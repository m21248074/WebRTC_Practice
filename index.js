const fs=require('fs');
const https=require('https');
const express=require('express');
const WebSocket=require('ws');
const WebSocketServer = WebSocket.Server;

let options=
{
    key: fs.readFileSync('./key.pem'),
    ca: [fs.readFileSync('./CA/cert.pem')],
    cert: fs.readFileSync('./cert.pem')
}

const port=3000;

const app=express();
app.use(express.static("public"));

const server=https.createServer(options);
server.listen(port,()=>
{
    console.log(`Listening at http://localhost:${port}`);
})
server.on('request',app);

const wss=new WebSocketServer(
    {
        server: server
    }
);

let roomData=
{
    names: [],
    ws: []
};

wss.on('connection',(ws,req)=>{
    let userName;
    ws.on("message",(data)=>
    {
        myjson=JSON.parse(data);
        if(myjson.type=="join")
        {
            let username=myjson.username;
            roomData.names.push(username);
            roomData.ws.push(ws);
            wss.clients.forEach((client)=>
            {
                client.send(JSON.stringify(
                {
                    type: "join",
                    username: username,
                    userList: roomData.names //for connection with other or offer
                }));
            });
            userName=myjson.username;
            ws.userName=myjson.username;
        }
        else
        {
            wss.clients.forEach((client)=>
            {
                if(client!=ws)
                    client.send(data);
            })
        }
    });
    ws.on("close",(code,reason)=>
    {
        roomData.names=roomData.names.filter((name)=>
        {
            return name!=userName;
        });
        roomData.ws=roomData.ws.filter((client)=>
        {
            return client.userName!=userName;
        });
        wss.clients.forEach((client)=>
        {
            client.send(JSON.stringify(
                {
                    type: "disconnect",
                    "username": userName
                }));
        });
    });
});