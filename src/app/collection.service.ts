import { Injectable } from '@angular/core';
import { Collection, SavedCollection, Rewards } from 'app/game_model/collection';
import { AuthenticationService } from 'app/user/authentication.service';
import { HttpClient } from '@angular/common/http';
import { apiURL } from './url';
import { cardList } from 'app/game_model/cards/cardList';

const saveURL = `${apiURL}/api/cards/storeCollection`;
const loadUrl = `${apiURL}/api/cards/getCollection`;
const buyPackURL = `${apiURL}/api/cards/buy`;
const openPackURL = `${apiURL}/api/cards/openPack`;
const dailyURL = `${apiURL}/api/cards/checkDaily`;

@Injectable()
export class CollectionService {
  private collection = new Collection();

  static describeReward(reward: Rewards): string {
    let msg = `You earned ${reward.gold} gold`;
    if (reward.packs === 1)
      msg += ` and a card pack`;
    else if (reward.packs > 1)
      msg += ` and ${reward.packs} card packs`;
    return msg + '.';
  }

  constructor(
    private auth: AuthenticationService,
    private http: HttpClient
  ) {
    auth.onAuth((data) => {
      if (data)
        this.load();
    });

  }

  private checkDaily() {
    this.http.get(dailyURL, { headers: this.auth.getAuthHeader() })
      .toPromise()
      .then((res: { daily: boolean, cards: string[], nextRewardTime: number }) => {
        if (!res.daily) {
          let wait = (res.nextRewardTime / 1000 / 60 / 60).toFixed(0);
          alert(`You can get another daily reward in ${wait} hours.`);
          return;
        }

        for (let cardId of res.cards) {
          let name = cardList.getCard(cardId).getName();
          this.collection.addCard(cardId);
          alert(`You got ${name} as a daily login reward`);
        }

      });
  }

  public unlockAll() {
    for (let card of cardList.getCards()) {
      let diff = 4 - this.collection.getCardCount(card);
      this.collection.addCard(card, Math.max(diff, 0));
    }
  }

  public save() {
    return this.http.post(saveURL,
      { collection: this.collection.getSavable() },
      { headers: this.auth.getAuthHeader() })
      .toPromise();
  }

  public load() {
    return this.http.get(loadUrl, { headers: this.auth.getAuthHeader() })
      .toPromise()
      .then((res: SavedCollection) => {
        this.collection.fromSavable(res);
        this.checkDaily();
      });
  }

  public async openPack() {
    return this.http.post<string[]>(openPackURL, { item: 'pack' },
      { headers: this.auth.getAuthHeader() }).toPromise()
      .then(ids => {
        this.collection.removePack();
        return ids.map(id => {
          let card = cardList.getCard(id);
          this.collection.addCard(card);
          return card;
        });
      })
      .catch(errData => {
        if (errData.error)
          this.collection.removePack();
        return errData.error ? errData.error.message : errData.message;
      });
  }

  public buyPack() {
    return this.http.post(buyPackURL, { item: 'pack' },
      { headers: this.auth.getAuthHeader() }).toPromise()
      .then(() => {
        this.collection.buyPack();
        return true;
      })
      .catch((err) => {
        return false;
      });
  }



  public getCollection() {
    return this.collection;
  }

  public async onGameEnd(won: boolean, quit: boolean) {
    if (!won && quit) {
      return '';
    }
    let reward: Rewards;
    try {
      reward = await this.http.post<Rewards>(`${apiURL}/api/cards/reward`,
        { won: won },
        { headers: this.auth.getAuthHeader() }).toPromise();
    } catch (e) {
      console.error(e);
      return 'Error loading rewards.';
    }

    this.collection.addReward(reward);
    return CollectionService.describeReward(reward);
  }


}
