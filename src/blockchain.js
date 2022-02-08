/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */
const moment = require('moment');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

const FIVE_MINUTES_IN_SECONDS = 300;

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: 'Genesis Block' });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve) => {
      resolve(this.height);
    });
  }

  _generateNewTime() {
    return new Date().getTime().toString();
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        const errorLogs = await this.validateChain();
        if (errorLogs?.length > 0) {
          throw new Error('Blockchain is not valid');
        }
        const blockHeight = self.height + 1;
        block.height = blockHeight;
        if (blockHeight > 0) {
          block.previousBlockHash = self.chain[self.chain.length - 1].hash;
        }
        block.time = self._generateNewTime();
        block.hash = block.generateNewHash();
        self.chain.push(block);
        self.height = blockHeight;
        return resolve(block);
      } catch (err) {
        return reject(err);
      }
    });
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    const self = this;
    return new Promise((resolve, reject) => {
      try {
        const message = `${address}:${self._generateNewTime()}:starRegistry`;
        resolve(message);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        // Get the item from the message sent as a parameter
        const messageTime = parseInt(message.split(':')[1]);
        const mMessageTime = moment(messageTime);
        const mToday = moment();
        const elapsedTimeInSeconds = mToday.diff(mMessageTime, 'seconds');

        // Check if the time elapsed is less than 5 minutes
        // convert milliseconds to seconds
        if (elapsedTimeInSeconds >= FIVE_MINUTES_IN_SECONDS) {
          return reject(
            'Time elapsed between the message was sent and the current time must be less than 5 minutes'
          );
        }

        // Verify the message with wallet address and signature
        const isMessageValid = bitcoinMessage.verify(
          message,
          address,
          signature
        );
        if (!isMessageValid) {
          return reject('Message is not valid');
        }

        // Create the block and add it to the chain
        const block = new BlockClass.Block({ owner: address, star });
        const blockAdded = await self._addBlock(block);

        // Resolve with the block added
        return resolve(blockAdded);
      } catch (err) {
        return reject(err);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve) => {
      const block = self.chain.find((block) => block.hash === hash);
      resolve(block);
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve) => {
      const block = self.chain.find((p) => p.height === height);
      resolve(block);
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    let stars = [];
    return new Promise((resolve, reject) => {
      self.chain.forEach((block) => {
        if (block.height === 0) {
          return false;
        }
        let body = '';
        try {
          body = block.getBData();
        } catch (err) {
          return false;
        }

        if (body.owner === address) {
          stars.push(body);
        }
      });

      resolve(stars);
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  validateChain() {
    let self = this;
    let errorLog = [];
    return new Promise(async (resolve, reject) => {
      try {
        for (const block of self.chain) {
          const isValid = await block.validate();
          if (!isValid) {
            errorLog.push(block);
          }

          if (block.height > 0) {
            const isPreviousHashValid =
              block.previousBlockHash === self.chain[block.height - 1].hash;
            if (!isPreviousHashValid) {
              errorLog.push(block);
            }
          }
        }
        resolve(errorLog);
      } catch (err) {
        return reject(err);
      }
    });
  }

  async tamperWithBlockByHeight(height) {
    const block = await this.getBlockByHeight(height);
    if (!block) {
      return block;
    }
    block.hash = '123' + height;
    return block;
  }
}

module.exports.Blockchain = Blockchain;
