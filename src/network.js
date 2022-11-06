import { initializeApp } from "firebase/app";
import { query, getFirestore, collection, arrayUnion, doc, setDoc, addDoc, onSnapshot, getDoc, updateDoc, getDocs, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQW5gh7ucgZvI5qtBHADZ2BjkKeRwXn_4",
  authDomain: "smwo-3b393.firebaseapp.com",
  projectId: "smwo-3b393",
  storageBucket: "smwo-3b393.appspot.com",
  messagingSenderId: "317990663235",
  appId: "1:317990663235:web:278f031f085fad148350f6"
};

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const firebase = initializeApp(firebaseConfig);
const firestore = getFirestore(firebase);

export const MAXPLAYERS = 8;


export class Lobby {
  constructor(playerName, onmessage) {
    this.playerName = playerName;
    this.cons = [];
    this.onmessage = onmessage;
    this.playerNames = [this.playerName];
    this.playerIdx = 0;
    this.remoteLevelString = null;
    this.clientOldLobbyNoCon = null;
    this._connectedAlready = [];
  }

  getPlayerIdx(name) {
    this.cons.forEach((con, idx) => {
      if (con.name === name) return idx;
    });
    return -1;
  }

  send(msg_type, object) {
    let json = JSON.stringify({ty: msg_type, msg: object});
    this.cons.forEach(con => {
      con.safe.send(json);
    });
  }

  sendUnreliable(msg_type, object) {
    let json = JSON.stringify({ty: msg_type, msg: object});
    try {
      this.cons.forEach(con => {
        con.udplike.send(json);
      });
    } catch {
      console.log(this.cons);
      throw "Cannot read properties of null (reading 'send') in sendUnreliable";
    }
  }

  async waitForPlayers(customLevelString) {
    const joinCode = this.playerName + Math.floor(Math.random() * 1000).toString();
    const lobbyDocSet = await setDoc(doc(firestore, "lobbies", joinCode), {
        hostName: this.playerName,
        joinCode: joinCode,
        players: 1,
        customLevel: customLevelString
    });
    const lobbyDoc = doc(collection(firestore, "lobbies"), joinCode);
    const lobbyClients = collection(lobbyDoc, "clients");

    // Delete all old client documents from that collection (because there was an older lobby with that name)
    {
      const allClientsSnap = await getDocs(lobbyClients);
      allClientsSnap.forEach(async doc => {
        await deleteDoc(doc.ref);
      });
    }

    this.onNewClientRequest = onSnapshot(lobbyClients, snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type != "added") return;
        if (this.cons.length + 1 >= MAXPLAYERS) {
          console.log("too many players, stopped a connection.");
          return;  // Dont add more than 8 players
        }

        // First check to see if we have already added the player
        let clientName = change.doc.data().clientName;
        this._connectedAlready.forEach(name => {
          if (clientName == name) clientName = "%%CONNECTED%%";
        });
        if (clientName == "%%CONNECTED%%") {
          console.log("a player who is already in the game tried to connect again.");
          return;
        }
        this._connectedAlready.push(clientName);

        // A new player wants to join!
        let con = new Connection(this, clientName);
        await con.initForServer(doc(lobbyClients, change.doc.id));
        this.cons.push(con);
        if (this.cons.length + 1 >= MAXPLAYERS) {
          console.log("player max reached");
          await setDoc(doc(firestore, "lobbies", joinCode), {
            players: MAXPLAYERS,
          });
        }
      });
    });

    return lobbyDoc.id;
  }

  async connectToLobby(joinCode) {
    if (this.cons.length > 0) {
      throw "Already joining...";
    }

    const lobbyDoc = doc(collection(firestore, "lobbies"), joinCode);
    let docSnap = await getDoc(lobbyDoc);
    let lobbyData = docSnap.data();
    if (!docSnap.exists() || lobbyData.players >= MAXPLAYERS) {
      console.log(joinCode);
      throw "Cant connect";
    }
    this.remoteLevelString = lobbyData.customLevel;
    const lobbyClients = collection(lobbyDoc, "clients");
    const clientDoc = await addDoc(lobbyClients, {
      clientName: this.playerName
    });

    // Set a timeout... if we dont connect in 4 seconds... tell the game
    setTimeout(() => {
      if (this.cons[0].safe == null || this.cons[0].safe.readyState != "open") {
        this.cons.pop();
        if (this.clientOldLobbyNoCon != null)
          this.clientOldLobbyNoCon();
      }
    }, 4000);

    // Now the server is going to try to connect to us
    let con = new Connection(this, lobbyData.hostName);
    await con.initForClient(clientDoc);
    this.cons.push(con);
    return joinCode;
  }

  stopWaitingForPlayers() {
    if (this?.onNewClientRequest) this.onNewClientRequest();
    this.cons.forEach(con => {con.stopLobbySnooping();});
  }
}

export class Connection {
  constructor(lobby, name) {
    this.peer = new RTCPeerConnection(servers);
    this.safe = null;
    this.udplike = null;
    this.name = name;
    this.lobby = lobby;
    this.removedMyself = false;
  }

  stopLobbySnooping() {
    this.unsubscribe();
  }

  // getLobbyConId() {
  //   this.lobby.cons.forEach((con, idx) => {
  //     if (con === this) return idx;
  //   });
  //   return undefined;
  // }

  onMessage(data) {
    var json;
    
    json = JSON.parse(data);
    if (json.ty == "pl") { // We've got a player list (as a client)
      json.msg.list.forEach((playerName, idx) => {
        this.lobby.playerNames[idx] = playerName;
      });
      while (json.msg.list.length < this.lobby.playerNames.length) {
        this.lobby.playerNames.pop();
      }
      this.lobby.playerNames.forEach((name, idx) => {
        if (name === this.lobby.playerName) this.lobby.playerIdx = idx;
      });
    }
    this.lobby.onmessage(json.ty, json.msg);
  }

  updatePlayerListForClients(/*removed*/) {
    while (true) {
      let players = {
        ty: "pl",
        msg: {
          list: [this.lobby.playerName],
          //removed: removed,
          //inGameId: nextID,
        }
      };
      this.lobby.cons.forEach(con => {
        if (con != null) players.msg.list.push(con.name);
      });
      let badCon = false;
      this.lobby.cons.forEach((con, idx) => {
        if (badCon) return;
        try {
          con.safe.send(JSON.stringify(players));
        } catch {
          console.log("Bad connection! (id:" + idx + ") (name: \"" + con.name + "\")");
          badCon = true;
          this.lobby.cons.splice(idx, 1);
          con.safe.close();
          if (!con.removedMyself) con.removeMyself();
        }
      });
      if (!badCon) break;
    }
  }

  removeMyself() {
    if (this.removedMyself) return;

    console.log("removing connection");

    // let removed = -1;
    // this.lobby.playerNames.forEach((name, idx) => {
    //   if (name === this.name) removed = idx;
    // });
    this.lobby._connectedAlready.forEach((name, idx) => {
      if (name === this.name) this.lobby._connectedAlready.splice(idx, 1);
    });
    console.log("splicing name!");
    this.lobby.cons.forEach((con, idx) => {
      if (con === this) {
        this.lobby.playerNames.splice(idx+1, 1);
        this.lobby.cons.splice(idx, 1);
      }
    });
    this.updatePlayerListForClients(/*removed*/);
    // let playerNamesTemp = [];
    // this.lobby.playerNames.forEach((name, idx) => {
    //   if (idx != removed) playerNamesTemp.push(name);
    // });
    this.lobby.onmessage("pl", {
      list: this.lobby.playerNames,
      //removed: removed
    });
    //this.lobby.playerNames.splice(removed, 1);
    this.removedMyself = true;
  }

  async initForServer(clientDoc) {
    this.safe = this.peer.createDataChannel("reliable+ordered", {
      ordered: true
    });
    this.udplike = this.peer.createDataChannel("unreliable+unordered", {
      ordered: false,
      maxRetransmits: 0
    });
    this.peer.onicecandidate = async event => {
      event.candidate && await updateDoc(clientDoc, {
        hostCandidates: arrayUnion(event.candidate.toJSON())
      });
    };
    this.safe.onopen = () => {
      console.log("safe channel opened");
      this.lobby.playerNames.push(this.name);
      this.updatePlayerListForClients(-1);
    };
    this.udplike.onopen = () => {
      console.log("udplike channel opened");
    }
    this.udplike.onmessage = event => {
      this.onMessage(event.data);
    };
    this.safe.onmessage = event => {
      this.onMessage(event.data);
    };
    this.safe.onclose = event => {
      this.removeMyself();
    };

    const offerDesc = await this.peer.createOffer();
    await this.peer.setLocalDescription(offerDesc);

    await updateDoc(clientDoc, {
      hostOffer: offerDesc.toJSON()
    });

    setTimeout(() => {
      if (this.safe.readyState != "open") {
        this.removeMyself();
        this.safe.close();
      }
    }, 3750); // If the connection isn't setup after 3.75 seconds, then terminate it

    let candidatesObtained = 0;
    let candidates = [];
    this.unsubscribe = onSnapshot(clientDoc, snapshot => {
      const data = snapshot.data();
      if (this.peer.currentRemoteDescription == null && data?.clientAnswer) {
        console.log("got answer");
        this.peer.setRemoteDescription(new RTCSessionDescription(data.clientAnswer));
        candidates.forEach(candidate => {
          console.log("got answer, adding ICE candidate late...");
          this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
      if (data?.clientCandidates && data.clientCandidates.length > candidatesObtained) {
        while (candidatesObtained < data.clientCandidates.length) {
          let candidate = data.clientCandidates[candidatesObtained++];
          if (this.peer.currentRemoteDescription != null) {
            this.peer.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("got ice");
          }
          else
            candidates.push(candidate);
        }
      }
    });
  }

  async initForClient(clientDoc) {
    this.peer.onicecandidate = async event => {
      event.candidate && await updateDoc(clientDoc, {
        clientCandidates: arrayUnion(event.candidate.toJSON())
      });
    };
    this.peer.ondatachannel = event => {
      if (event.channel.ordered) { //safe
        console.log("safe channel opened");
        this.safe = event.channel;
        this.safe.onmessage = event => {
          this.onMessage(event.data);
        };
      }
      else { //unordered
        console.log("udplike channel opened");
        this.udplike = event.channel;
        this.udplike.onmessage = event => {
          this.onMessage(event.data);
        };
      }
    };

    let gotOffer = false;
    let lastIceCandidateCount = 0;
    this.unsubscribe = onSnapshot(clientDoc, async snapshot => {
      const data = snapshot.data();
      if (this.peer.currentRemoteDescription == null && data?.hostOffer && !gotOffer) {
        gotOffer = true;
        await this.peer.setRemoteDescription(new RTCSessionDescription(data.hostOffer));
        const answerDesc = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answerDesc);

        await updateDoc(clientDoc, {
          clientAnswer: answerDesc.toJSON()
        });
        console.log("got offer, giving answer...");
      }
      if (data?.hostCandidates && data.hostCandidates.length > lastIceCandidateCount) {
        while (lastIceCandidateCount < data.hostCandidates.length) {
          let candidate = data.hostCandidates[lastIceCandidateCount++];
          if (candidate != null) {
            this.peer.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("got ice");
          }
        }
      }
    });

    // Failsafe
    setTimeout(async () => {
      await updateDoc(clientDoc, {
        clientFailsafe: "failsafeForOffers"
      });
    }, 750);
  }
}
