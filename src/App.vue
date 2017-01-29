<template>
  <div id="app" class="container">
    <h2>Спасаем мир v.0.1</h2>
    <h2 v-if="token" class="help-block">
      ({{ token }})
    </h2>
    <button @click="stopConnection">Не спасать</button>

    <hr>

    <div class="row">
      <div class="col-md-8">

        <table class="table table-bordered table-condensed">
          <thead>
            <tr>
              <th class="col-md-1">Code</th>
              <th class="col-md-1">0-1</th>
              <th class="col-md-1">1-2</th>
              <th class="col-md-1">2-3</th>
              <th class="col-md-10">Available valid states</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in codes">
              <td>{{ item.code }}</td>
              <td :class="cellClass(item.check[0])">{{ item.check[0] }}</td>
              <td :class="cellClass(item.check[1])">{{ item.check[1] }}</td>
              <td :class="cellClass(item.check[2])">{{ item.check[2] }}</td>
              <td>{{ filterMessagesByCode(item.code) }}</td>
            </tr>
          </tbody>
        </table>

      </div>
      <div class="col-md-4">

        <div v-for="item in messages">{{ item }}</div>

      </div>
    </div>

  </div>
</template>

<script>
import 'bootstrap/dist/css/bootstrap.css';
import Vue from 'vue';

export default {
  name: 'app',
  data: () => ({

    // API
    url: 'ws://nuclear.t.javascript.ninja',
    socket: null,

    // Победный токен
    token: '',

    // Список состояний
    messages: [],

    // Ограничение на количество валидных состояний
    listLimit: 10,

    // Коды сочетаний
    codes: {},

    // Состояния переключателей
    pulls: [true, true, true, true],

  }),
  computed: {
    // Код текущего сочетания переключателей
    currentCode () {
      return this.pulls.map(Number).join('');
    },
  },
  methods: {

    // Подключение
    initConnection () {
      this.socket = new WebSocket(this.url);
      this.socket.onmessage = (event) => {
        let message = JSON.parse(event.data);
        this.onmessage(message);
      };
    },

    // Отключение
    stopConnection () {
      this.socket.close();
      console.log(`Можно идти пить кофе`);
    },

    // Отправка сообщения
    send (message) {
      this.socket.send(JSON.stringify(message));
    },

    // Отправка сообщение на отключение
    sendPowerOff(stateId) {
      this.send({
        action: "powerOff",
        stateId: stateId
      });
    },

    // Стилизация ячейки
    cellClass (status) {
      if (status === 'null')
        return 'active';

      return status === true
        ? 'success'
        : 'danger';
    },

    // Отфильтрованные stateId по коду
    filterMessagesByCode (code) {
      return this.messages
        .filter(x => x.code === code)
        .map(x => x.stateId);
    },

    turnOff(code) {

      var items = this.messages.filter(x => x.code === code);
      if (!items.length) {
        console.error(`Нет валидных состояний`);
        return;
      }

      var stateId = items[items.length - 1].stateId;

      // console.log(`[OFF] code ${code}, stateId ${stateId}`);

      this.sendPowerOff(stateId);
    },

    // Меняем переключатель
    changePull (id) {
      Vue.set(this.pulls, id, !this.pulls[id]);
    },

    // Добавляем новый статус
    addState(code, stateId) {
      let item = this.codes[code];

      if (item === undefined) {

        item = {
          code,
          check: ['null', 'null', 'null']
        };

        Vue.set(this.codes, code, item);
      }

      let needCheck = item.check.some(x => x === 'null');
      if (!needCheck) {
        return;
      }

      if (item.check[0] === 'null') {
        this.sendChecks(code, 0, stateId);
        return;
      }

      if (item.check[1] === 'null') {
        this.sendChecks(code, 1, stateId);
        return;
      }

      if (item.check[2] === 'null') {
        this.sendChecks(code, 2, stateId);
        return;
      }
    },

    // Отправляем проверки сочетания переключателей
    sendChecks(code, index, stateId) {
      // console.log(`[${code}] SEND CHECK ${stateId}`);

      this.send({ action: "check", "lever1": index, "lever2": index + 1, stateId });
    },

    receiveCheck(incoming) {
        // console.log(incoming);

        let code = this.messages
          .find(x => x.stateId === incoming.stateId)
          .code;

        let index = incoming.lever1;

        this.codes[code].check[index] = incoming.same;

        let everyTRUE = this.codes[code].check.every(x => x === true);
        if (everyTRUE) {
          console.log(`AUTOOFF for code ${code}`);
          this.turnOff(code);
        }
    },

    receiveNewState (incoming) {
      console.log(incoming);
      if (incoming.newState === 'poweredOff') {
        this.token = incoming.token;
        this.stopConnection();
      }
    },

    onmessage (incoming) {

      // Ошибки
      if (incoming.error) {
        console.error(incoming.error);
        return;
      }

      // Новые состояния системы
      if (incoming.newState) {
        this.receiveNewState(incoming);
        return;
      }

      // Ответы на проверки
      if (incoming.action === 'check') {
        this.receiveCheck(incoming);
        return;
      }

      // Новое изменение переключателя

      this.changePull(incoming.pulled);

      incoming.code = this.currentCode;

      this.messages = this.messages
        .concat(incoming)
        .filter(x => x.stateId > incoming.stateId - this.listLimit);

      this.addState(this.currentCode, incoming.stateId);
    },
  },
  mounted () {
      this.initConnection();
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  font-size: 10px;
}
</style>
