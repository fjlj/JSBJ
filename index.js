let balance = 2500;
const cards = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const suits = ["H", "D", "C", "S"];
let MAX_BET = 250;
const MIN_BET = 5;
const DEALER_POS = 4;
let deck = [];
let discard = [];
let shuffle_seed = [];
let last_seed = [];
let validBets = [];
let actionPerformed = false;
let gameState = "T";
let gsCtime = 20;
let lastPlayers = [];
let activePlayer;
let deck_generation_lock = false;
let additional_pause = 0;
let _numDecks;
let selected_amount = 0;
let height;
let width;
let bet_buttons;
let lastTime;
const step = (1.0/240.0);
let accum = 0.0;
let gsTimer = 0.0;

//called from HTML when player selects play after deciding the number of decks they wish to use.
function startGame(nd){
    let inputs = nd.parentElement.getElementsByTagName("input");
    let pinp_nd = parseInt(inputs[0].value);
    let pinp_mb = parseInt(inputs[1].value);
    let pinp_sb = parseInt(inputs[2].value);
    generateDeck(isNaN(pinp_nd) ? 6 : pinp_nd);
    balance = (isNaN(pinp_sb) ? 2500 : pinp_sb);
    updateBalance();
    MAX_BET = (isNaN(pinp_mb) ? 250 : pinp_mb);
    document.getElementById('numDecks').style.display = "none";
    document.getElementById('main').style.display = "block";
	gameState = "B";
}

function doBetStuff(amnt) {
    if (gameState !== "B" && gameState !== "N") return;

    selected_amount = parseInt(amnt);

    for (let i = 0; i < 4; i++) {
        if(bet_buttons[i%bet_buttons.length].getAttribute("name") === ("bet_"+selected_amount.toString())){
            if(!bet_buttons[i%bet_buttons.length].classList.contains("selBet"))
                bet_buttons[i%bet_buttons.length].classList.add("selBet");
        } else {
            bet_buttons[i%bet_buttons.length].classList.remove("selBet");
        }
        document.getElementById("hand" + i + "O").classList.add("selHand");
    }
}

let animated_cards = [];
class card_obj {
    constructor(_el = undefined,_mouseX = width*0.08,_mouseY = width*0.04,_x=0,_y=0,_id="",_pos = 0) {
        this.id = (_id === "" ? Math.floor((Math.random() * 1000000) % 10000).toString() + "-" + Math.floor((Math.random() * 1000000) % 10000).toString() + "-" + Math.floor((Math.random() * 1000000) % 10000).toString() : _id);
        this.mouseX = _mouseX;
        this.mouseY = _mouseY;
        this.el = _el;
        this.finished = 0;
        this.x = _x;
        this.y = _y;
		this.counted = false;
        this.pos = _pos;
        this.w = (width * 0.06);
        this.h = (width * 0.08);
        this.update = function () {
            let l = this.x - this.w / 2;
            let t = this.y - this.h / 2;
            let curStyle = this.el.style.cssText.split(";");
            curStyle[1] = "transform: translate3d(" + l + "px, " + t + "px, 0px);";
            this.el.style.cssText = curStyle.join(";");
            if(this.pos === DEALER_POS && !this.counted){
                let fin_count = animated_cards.filter((c) => {return (c.finished === 1 && c.pos === DEALER_POS);}).length;
                if(fin_count > 1 && gameState !== "N") {
                    document.getElementById("dealer_tot").innerHTML = "Dealer: " + sumHand({hand:dealer.hand.slice(0,fin_count+1),wasSplit:false}).toString();
					this.counted = true;
                }
            }

			if((Math.abs(this.x - this.mouseX) + Math.abs(this.y - this.mouseY)) <= 1 && this.finished % 2 === 0)
                this.finished++;
			
            if(this.finished > 3)
                this.finished = 3;
        }
    }
}

function move(card,dt) {
    card.x += (card.mouseX - card.x) * 9 * dt; // old style
    card.y += (card.mouseY - card.y) * 9 * dt; // old style
    if(!card.el.style.display.includes("flex"))
        card.el.style.display = "flex";
    card.update();
}
function up_accum(dt) {
    accum += dt;
    while (accum > step) {
        let disc = false;
        let readyToDraw = animated_cards.filter((ac)=>{return ac.finished % 2 === 0});
        for(let t of readyToDraw) {
            disc = readyToDraw.filter((f) => {return f.finished === 0}).length > 1;
            move(t, step);
            if(disc)
                break;
        }
        if(!disc && newDeal) {
            if (dealer.val[0] !== "B") {
                gameState = "W";
            } else {
                newDeal = false;
                if(gameState === "D"){
                    gameState = "P"
                } else {
                    gameState = "D";
                }
            }
        }
        accum -= step;
    }
    animated_cards = animated_cards.filter((c)=>{if(c.finished >=3 && c.id !== "draw") {c.el.remove();} return c.finished < 3;});
}

function up_gsTimer(dt){
    gsTimer += dt;
    while (gsTimer > 0.9) {
        gameStateTimer(--gsCtime)
        gsTimer -= 0.9;
    }
}

//make a player class
let player = function (pos, _h = [], _ws = false, _b = 0, _v = 0, _s = "wait", _iS = false) {
    return {
        position: pos,
        hand: _h,
        wasSplit: _ws,
        isSplit: _iS,
        bet: _b,
        val: _v,
        state: _s
    }
}

let players = [];

const dealer = new player(4);

function getRandomDeckIndex() {
    //generate a random index from the current deck length to insert the next card into
    return Math.floor(Math.random() * deck.length);
}

function generateDeck(numDecks = 0) {
    if (deck_generation_lock)
        return;

    if (_numDecks && numDecks === 0)
        numDecks = _numDecks;

    _numDecks = numDecks <= 0 ? 1 : numDecks;
    deck_generation_lock = true;

    deck = [];
    shuffle_seed = [];
    let rand_ind = 0;
    //simulate random insertion
    while (numDecks > 0) {
        for (let suit of suits) {
            for (let card of cards) {
                rand_ind = getRandomDeckIndex();
                shuffle_seed.push(rand_ind);
                deck.splice(rand_ind, 0, card + suit);
            }
        }
        numDecks--;
    }

    //finally swap first 1/4 elements with random index due to low insertion options in beginning.
    for (let i = 0; i < Math.floor(deck.length / 4); i++) {
        rand_ind = getRandomDeckIndex();
        shuffle_seed.push(rand_ind);
        [deck[i], deck[rand_ind]] = [deck[rand_ind], deck[i]];
    }
    //should not happen... but in case something got messed up...
    deck = deck.filter((c)=>{return c !== undefined;});

    //will need number of decks in seed to be able to recreate
    shuffle_seed.push(_numDecks);

    //ensuring that the generator is not trying to run too soon.
    setTimeout(function () {
        deck_generation_lock = false;
    }, 1000*numDecks);

}

function getPlayerFromPosition(position) {
    for (let p of players) {
        if (p.position === position && position <= 4 && position >= 0)
            return p;
    }

    //did not return a player (create one  and return it, if a valid position was given)
    if (position <= 3 && position >= 0) {
        let newPlayer = new player(position);
        players.push(newPlayer);
        return newPlayer;
    }
}

function shuffle() {
    additional_pause = 1.5;
    discard = [];
    last_seed = [...shuffle_seed];
    console.log(shuffle_seed.join(","));
    generateDeck();
}


function updateBetText(t, sub = "", amt = 0, p = undefined) {
    let amnt_div = t.getElementsByTagName("div")[0];
    if (gameState === "B" && updatePlayerBet(parseInt(t.id[4]),sub)) {
        if(sub === "-"){
            amnt_div.innerHTML = (parseInt(amnt_div.innerHTML) - selected_amount).toString();
        } else {
            amnt_div.innerHTML = (parseInt(amnt_div.innerHTML) + selected_amount).toString();
        }
    }

    if (gameState === "W" && amt !== 0) {
        if (p && p.wasSplit || p === "newsplit") {
            let cur = amnt_div.innerHTML.toString();
            if (cur.includes("/") && p !== "newsplit") {
                let tots = cur.split("/");
                tots[(p.isSplit ? 1 : 0)] = (parseInt(tots[(p.isSplit ? 1 : 0)]) + amt).toString();
                amnt_div.innerHTML = tots.join("/");
            } else {
                amnt_div.innerHTML = amnt_div.innerHTML + "/" + amt;
            }
        } else {
            amnt_div.innerHTML = parseInt(amnt_div.innerHTML) + amt;
        }
    }
}

function updatePlayerBet(position = 0,sub = "") {
    let p = getPlayerFromPosition(position);
    if(sub === "-" && gameState === "B" && p.bet >= selected_amount){
        p.bet -= selected_amount;
        balance += selected_amount;
        updateBalance();
        return true;
    }

    if (sub === "" && balance >= selected_amount && (p.bet + selected_amount) <= MAX_BET && gameState === "B") {
        p.bet += selected_amount;
        balance -= selected_amount;
        updateBalance();
        return true;
    }
    return false;
}


function deal() {
    let activePlayers = [];
	for (let j = 0; j < players.length; j++) {
        let playerAtPos = getPlayerFromPosition(j);
        if (playerAtPos.bet >= MIN_BET) {
            //set the highest position that has a bet... since that position will play first.
            activePlayers.push(playerAtPos);
        }
    }

	if((discard.length / deck.length >= 0.66 && _numDecks !== 1) || (_numDecks === 1 && deck.length < (activePlayers.length+1)*2))
		return ["Shuff"];
	
	if(activePlayers.length > 0){
		for (let i = 0; i < 2; i++) {
			for(let o = 3; o >= 0; o--) {
                activePlayers[o].hand.push(deck.pop());
            }
            dealer.hand.push(deck.pop());
		}
	}
    //there is at least 1 player, return array of players with valid bets
    return activePlayers;
}

function focusHand(pos) {
    for (let i = 0; i < 4; i++) {
        document.getElementById("hand" + i + "O").classList.remove("curHand");
        if (pos === i)
            document.getElementById("hand" + i + "O").classList.add("curHand");
    }
}

function play() {
    validBets = deal();

    if (validBets.length > 0) {
		if(validBets[0] === "Shuff"){
			shuffle();
			validBets = [];
			return "Shuffling, Previous Seed Logged.";
		}

        sumHands(validBets);
        dealer.val = sumHand(dealer);
        return "";
    } else {
        return "No bets placed!";
    }
}

function setFeedback(output) {
    document.getElementById("feedback").innerHTML = output.toString() === "0" ? '&nbsp;' : output;
}

function animateDiscard(card) {
    let dcard_pos = document.getElementById('dcard').getBoundingClientRect();
    card.el.innerHTML = "";
    card.el.id = 'card-gone';
    card.mouseX = ~(card.el.getBoundingClientRect().x-dcard_pos.x-dcard_pos.width);
    card.mouseY = ~(card.el.getBoundingClientRect().y-dcard_pos.y-dcard_pos.height);
    card.finished++;
}

function animateDrawCard(pos, num, value, split = false) {
    let newcard = document.getElementById('card').cloneNode(true);
    newcard.id = "card" + pos + (split ? "-s-" : "") + "-" + num + "-delt";

    let cText = value.replace("H", "&hearts;").replace("D", "&diams;").replace("S", "&spades;").replace("C", "&clubs;");
    newcard.innerHTML = (value[value.length - 1] === "H" || value[value.length - 1] === "D" ?
        "<p style='color:red'>" : "<p style='color:black'>") + cText + "</p>";
    newcard.style.display = "none";

    let pos_obj = (split ? document.getElementById("split" + pos) : document.getElementById("hand" + pos));

    pos_obj.appendChild(newcard);
    let newcard_pos = document.getElementById("hand"+pos).getBoundingClientRect();
    let draw_pile_pos = animated_cards.filter((c) => {return c.id === "draw";})[0];
    let card = new card_obj(newcard,(pos === DEALER_POS ? 55 : 15),(pos === DEALER_POS ? ~(width*-0.11) : ~(width*-0.015)),width - ((newcard_pos.x + draw_pile_pos.x)+draw_pile_pos.w),~(newcard_pos.y -draw_pile_pos.y+ (~(width*-0.015))),"",pos);
    animated_cards.push(card);
}

function animate(what, aframes = 2) {
    let card_ind = 0;
    switch (what) {
        case "dealer":
            card_ind = dealer.hand.length - aframes;
            if (aframes <= 0) {
                gameState = "P";
            } else {
                animateDrawCard(4, card_ind, dealer.hand[card_ind]);
                animate("dealer", --aframes);
            }
            break;

        case "deal":
            let playerPos = (aframes > validBets.length ? Math.abs((validBets.length + 1) - aframes) : (validBets.length - (validBets.length - aframes) - 1));
            card_ind = (aframes > validBets.length ? 0 : 1);
            setFeedback("&nbsp;");
            if (aframes <= 0) {
                newDeal = true;
            } else {
                if (validBets[playerPos].position === 4 && card_ind === 1) {
                    animateDrawCard(validBets[playerPos].position, card_ind, "");
                } else {
                    animateDrawCard(validBets[playerPos].position, card_ind, validBets[playerPos].hand[card_ind]);
                }
                animate("deal", --aframes);
            }
            break;

        case "clear_table":
            if (aframes <= 0) {
                gameState = "B";
            } else {
                for (let i = 0; i < Math.round(animated_cards.length / aframes); i++) {
                    if(animated_cards[i].id === "draw")
                        continue;
                    animateDiscard(animated_cards[i]);
                }
                animate("clear_table", --aframes);
            }
            break;
    }
}

function allPlayersBustOrBJ(players) {
    let countBorBJ = 0;
    for (let p of players) {
        if (p.val.toString().indexOf("Bust") >= 0 || p.val.toString().indexOf("Black") >= 0)
            countBorBJ++;
    }
    return countBorBJ === players.length;
}

function dealerHand() {
    if(dealer.hand.length <= 0)
        return;
    let total = sumHand(dealer);
    document.getElementById("dealer_tot").innerHTML = "Dealer: " + total.toString();
    let cards_drawn = 0;
    let cText = dealer.hand[1].replace("H", "&hearts;")
                              .replace("D", "&diams;")
                              .replace("S", "&spades;")
                              .replace("C", "&clubs;");
    document.getElementById('card4-1-delt').innerHTML =
        (dealer.hand[1][dealer.hand[1].length - 1] === "H" ||
         dealer.hand[1][dealer.hand[1].length - 1] === "D" ?
         "<p style='color:red'>" :
         "<p style='color:black'>" ) + cText + "</p>";

    while ((total === 17 && dealer.hand.join("").includes("A")) || total <= 16) {
        //a safeguard for drawing dealer hand on single deck...
        //a shuffle could not be triggered entering the dealer game state
        //if there are 2 or more cards left. this would cause issues if
        //the dealer ended up needing to draw more than 2 cards.
        if(_numDecks === 1 && deck.length < 1)
			shuffle();
		dealer.hand.push(deck.pop());
        cards_drawn++;
        total = sumHand(dealer);
    }

    dealer.val = (total[0] === "(" ? 0 : total);
    animate("dealer", cards_drawn);
}

function payWinners() {
    for (let p of lastPlayers) {
        let total = sumHand(p);
        if (total[0] === "B" && dealer.val[0] !== "B") {
            balance += Math.round(p.bet * 2.5);
            document.getElementById('bet' + p.position).innerHTML = 'Win! +$' + (p.bet * 2.5).toString() + "<br>" + document.getElementById('bet' + p.position).innerHTML;
        } else if (total > dealer.val) {
            balance += p.bet * 2;
            document.getElementById('bet' + p.position).innerHTML = 'Win! +$' + (p.bet * 2).toString() + "<br>" + document.getElementById('bet' + p.position).innerHTML;
        }

        if (total === dealer.val) {
            balance += p.bet;
            document.getElementById('bet' + p.position).innerHTML = 'Push!' + "<br>" + document.getElementById('bet' + p.position).innerHTML;
        }
    }
    //updateBalance();
    gameState = "N";
}

function totalBet(){
	return (["B","N"].includes(gameState) ? players.reduce((t,c)=>t+c.bet,0) : lastPlayers.reduce((t,c)=>t+c.bet,0));
}

function updateBalance() {
    document.getElementById("playerBalance").innerHTML = "Balance: " + balance;
	document.getElementById("total_bet").innerHTML = "Total Bet: " + totalBet();
}

function clearTable() {
    if (selected_amount !== 0)
        doBetStuff(selected_amount);

    let bets = document.getElementsByClassName("bamnt");
    for (let b of bets) {
        b.innerHTML = "0";
    }

    while (lastPlayers.length > 0) {
        let h = lastPlayers.pop();
        h.bet = 0;
        document.getElementById('bet' + h.position).innerHTML = "";
        document.getElementById("split" + h.position).style.display = "none";
        discard.push(...h.hand);
        h.hand = [];
        h.wasSplit = false;
    }
    discard.push(...dealer.hand);
    dealer.hand = [];
    updateBalance();
    animate("clear_table", 3);
}

let status = "";
let newDeal = false;

function gameStateTimer(time = 15) {
    additional_pause = 0.1;
    if (time < 0)
        gsCtime = 15;
    switch (gameState) {
        case "B":
            if (time === 0) {
                status = play();
                if (status[0] !== "N" && status[0] !== "S") {
                    additional_pause = 1;
                    lastPlayers = [...validBets];
                    validBets = [dealer, ...validBets];
                    let numCardsToDraw = (validBets.length) * 2;
                    for (let ii = 0; ii < 4; ii++) {
                        document.getElementById("hand" + ii + "O").classList.remove("selHand");
                    }
                    gameState = "T";
                    animate("deal", numCardsToDraw);
                } else {
                    gsCtime = status[0] === "S" ? 1 : 15;
                }
            } else {
                status = "Place your Bets: " + time.toString();
            }
            break;

        case "W":
			if(_numDecks === 1 && deck.length < 2){
				status = "Shuffling, Previous Seed Logged.";
                shuffle();
				break;
			}
            if(newDeal) {
                actionPerformed = true;
                validBets = validBets.slice(1, validBets.length);

                for (let t of validBets) {
                    document.getElementById("bet" + t.position).innerHTML = t.val.toString();
                }

                activePlayer = validBets.pop();
                while (validBets.length > 0 && activePlayer.val[0] === "B") {
                    activePlayer.state = "stand";
                    activePlayer = validBets.pop();
                }

                activePlayer.state = (activePlayer.val[0] === "B" ? "stand" : "active");
                focusHand(activePlayer.position);
            }
            newDeal = false;
            if (actionPerformed && activePlayer.state === "active") {
                gsCtime = 60;
            } else if (time === 0 || activePlayer.state !== "active") {
                if (time === 0)
                    activePlayer.state = "stand";

                document.getElementById("hand" + activePlayer.position).classList.remove("splitActive");
                document.getElementById("split" + activePlayer.position).classList.remove("splitActive");

                if (validBets.length > 0) {
                    activePlayer = validBets.pop();
                    activePlayer.state = (activePlayer.val[0] === "B" ? "stand" : "active");
                    if (activePlayer.val[0] !== "B")
                        focusHand(activePlayer.position);
                    if (activePlayer.isSplit)
                        document.getElementById("split" + activePlayer.position).classList.add("splitActive");
                    gsCtime = 60;
                } else {
                    focusHand(4);
                    gsCtime = 1;
                    gameState = "D";
                }
            }
            status = time.toString();
            actionPerformed = false;
            break;
        case "D":
			if(_numDecks === 1 && deck.length < 1){
				status = "Shuffling, Previous Seed Logged.";
                shuffle();
				break;
			}
            gameState = "T";
            if (!allPlayersBustOrBJ(lastPlayers)) {
                additional_pause = 1;
                dealerHand();
            } else {
                gsCtime = 1;
                additional_pause = 0.5;
                gameState = "P";
            }
            break;

        case "P":
            additional_pause = 1;
            gameState = "T";
            payWinners();
            break;

        case "N":
			//console.table(dealer);
            clearTable();
            //additional_pause = 0.5;
            document.getElementById("dealer_tot").innerHTML = "";
            break;

        case "T":
            gsCtime = 15;
            additional_pause = 0.5;
            break;

        //should never be reached
        default:
            console.log("should not be here... received:\'" + gameState + "\' state.");
            break;
    }

    if (gameState !== "T")
        setFeedback(status);

    gsTimer -= additional_pause;
}

function sumHand(h) {
    let total = 0;
    let aces = h.hand.filter((c) => {return (c[0] === "A");});
    let others = h.hand.filter((c) => {return !(c[0] === "A");});
    while (others.length > 0 && total <= 21) {
        let card = others.pop();
        if (["Q", "K", "J"].includes(card[0])) {
            total += 10;
        } else {
            total += parseInt(card);
        }
    }

    if(aces.length > 0){
        if(total + aces.length > 21) {
            total += aces.length;
        } else {
            while(aces.length > 0){
                aces.pop();
                if(total + (11 * (aces.length+1)) > 21){
                    total += 1;
                } else {
                    total += 11;
                }
            }
        }
    }

    if (total === 21 && h.hand.length === 2 && !h.wasSplit)
        return "BlackJack!";

    if (total > 21)
        return "(" + total + ") Bust!";

    return total;
}

function sumHands(vh) {
    for (let p of vh) {
        p.val = sumHand(p);
    }
}

function drawCard(pActing){
    pActing.hand.push(deck.pop());
    animateDrawCard(pActing.position, pActing.hand.length - 1, pActing.hand[pActing.hand.length - 1], pActing.isSplit);
    let playerHandSum = sumHand(pActing);
    updateCardTotals(pActing, playerHandSum);
    return playerHandSum;
}

function doSplit(p) {
    p.wasSplit = true;
    let split_p = new player(p.position, [p.hand.pop()], true, p.bet);
    split_p.isSplit = true;
    lastPlayers.push(split_p);
    validBets.push(split_p);
    let hand_dom = document.getElementById("hand" + p.position);
    hand_dom.classList.add("splitActive");
    let split_card = hand_dom.children[1];
    split_card.remove();
    let split_hand_dom = document.getElementById("split" + p.position);
    split_hand_dom.appendChild(split_card);
    split_hand_dom.style.display = "flex";
    p.hand.push(deck.pop());
    split_p.hand.push(deck.pop());

    animateDrawCard(p.position, p.hand.length - 1, p.hand[p.hand.length - 1]);
    let playerHandSum = sumHand(p);
    document.getElementById("bet" + p.position).innerHTML = playerHandSum;
    p.val = playerHandSum.toString();

        animateDrawCard(p.position, split_p.hand.length - 1, split_p.hand[split_p.hand.length - 1], true);
        playerHandSum = sumHand(split_p);
        document.getElementById("bet" + p.position).innerHTML += "/" + playerHandSum;
        split_p.val = playerHandSum.toString();
}

function updateCardTotals(p, sum) {
    if (p.wasSplit) {
        let cur = document.getElementById("bet" + p.position);
        let tots = cur.innerHTML.split("/");
        tots[(p.isSplit ? 1 : 0)] = sum;
        cur.innerHTML = tots.join("/");
    } else {
        document.getElementById("bet" + p.position).innerHTML = sum;
    }
}

function performAction(action) {
    if (gameState !== "W")
        return;

    let pActing = activePlayer;
    let playerHandSum = sumHand(pActing);
    actionPerformed = true;

    if (action === "hit") {
        playerHandSum = drawCard(pActing);
        if (playerHandSum.toString().indexOf("Bust!") >= 0 || playerHandSum === 21) {
            pActing.val = playerHandSum.toString();
            pActing.state = "stand";
        }
    }

    if (action === "double") {
        if (pActing.hand.length === 2 && balance >= 0) {
            if (balance >= pActing.bet) {
                balance -= pActing.bet;
                updateBetText(document.getElementById('hand' + pActing.position + 'O'),"", pActing.bet, pActing);
                pActing.bet += pActing.bet;
            } else {
                pActing.bet += balance;
                updateBetText(document.getElementById('hand' + pActing.position + 'O'), "", balance, pActing);
                balance = 0;
            }
            updateBalance();
            playerHandSum = drawCard(pActing);
            pActing.val = playerHandSum.toString();
            pActing.state = "stand";
        }
    }

    if (action === "split") {
        if (pActing.hand.length !== 2 || balance < pActing.bet || pActing.wasSplit)
            return;


        if (pActing.hand[0][0] === pActing.hand[1][0] || (playerHandSum === 20 && !pActing.hand.join().includes("A"))) {
            balance -= pActing.bet;
            updateBetText(document.getElementById('hand' + pActing.position + 'O'), "", pActing.bet, "newsplit");
            doSplit(pActing);
            updateBalance();
        }
    }

    if (action === "stand") {
        pActing.val = playerHandSum.toString();
        pActing.state = "stand";
    }
}

function logLastDeck(){
    if(!last_seed.length)
        return;

    let nd = last_seed[last_seed.length-1];
    let i = 0;
    let td = []
    while (nd > 0) {
        for (let suit of suits) {
            for (let card of cards) {
                td.splice(last_seed[i], 0, card + suit);
                i++;
            }
        }
        nd--;
    }

    let o = 0;
    while(i < last_seed.length-1) {
        [td[o], td[last_seed[i]]] = [td[last_seed[i]], td[o]];
        o++;
        i++;
    }
    last_seed = [];
    console.log(td.reverse().join(","));
}

function resizeListener() {
    height = window.document.body.clientHeight;
    width = window.document.body.clientWidth;
}

window.onload = function() {
    height = window.document.body.clientHeight;
    width = window.document.body.clientWidth;
    window.addEventListener("resize", resizeListener);

    bet_buttons = document.querySelectorAll("[name^='bet_']");

    document.getElementById("numDecks").style.display = "block";
    animated_cards.push((new card_obj(document.getElementById('card'),width*0.08,width*0.04,0,0,"draw")));

    const loopTimer = (millis) => {
        if(lastTime) {
            up_accum((millis - lastTime)/1000.0);
            up_gsTimer((millis - lastTime)/1000.0);
        }
        lastTime = millis;
        requestAnimationFrame(loopTimer);
    };

    loopTimer();
}















