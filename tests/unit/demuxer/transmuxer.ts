import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TransmuxConfig, TransmuxState } from '../../../src/demux/transmuxer';
import TransmuxerInterface from '../../../src/demux/transmuxer-interface';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import type { MediaFragment } from '../../../src/loader/fragment';
import type { TransmuxerResult } from '../../../src/types/transmuxer';

chai.use(sinonChai);
const expect = chai.expect;
describe('TransmuxerInterface tests', function () {
  let hls;

  afterEach(function () {
    sinon.restore();
    if (hls) {
      hls.destroy();
    }
  });

  const onTransmuxComplete = (res: TransmuxerResult) => {};
  const onFlush = (meta: ChunkMetadata) => {};

  it('can construct without a worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    ) as any;
    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.emit, 'emit exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.workerContext, 'workerContext is null').to.not
      .exist;
  });

  it('can construct with a worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    ) as any;
    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.emit, 'emit exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.workerContext, 'workerContext exists').to.exist;
  });

  it('can destroy a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterface.destroy();
    expect(transmuxerInterfacePrivates.observer, 'observer').to.not.exist;
    expect(transmuxerInterfacePrivates.transmuxer, 'transmuxer').to.not.exist;
    expect(transmuxerInterfacePrivates.workerContext, 'workerContext').to.not
      .exist;
  });

  it('can destroy an inline transmuxer', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterface.destroy();
    expect(transmuxerInterfacePrivates.observer, 'observer').to.not.exist;
    expect(transmuxerInterfacePrivates.transmuxer, 'transmuxer').to.not.exist;
    expect(transmuxerInterfacePrivates.workerContext, 'workerContext').to.not
      .exist;
  });

  it('pushes data to a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const stub = sinon.stub(
      transmuxerInterfacePrivates.workerContext.worker,
      'postMessage',
    );
    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;
    // Config for push
    transmuxerInterfacePrivates.frag = currentFrag;

    const part = null;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    let chunkMeta = new ChunkMetadata(currentFrag.level, currentFrag.sn + 1, 0);
    let state = new TransmuxState(false, true, true, false, 0, false);
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      currentFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    expect(stub).to.have.been.calledOnce;
    const firstCall = stub.args[0][0];
    expect(
      firstCall,
      'Demux call 1: ' + JSON.stringify(firstCall, null, 2),
    ).to.deep.include({
      cmd: 'demux',
      data,
      decryptdata: currentFrag.decryptdata,
      chunkMeta,
      state,
    });

    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 100;
    newFrag.sn = 6;
    newFrag.level = 1;
    newFrag.start = 1000;
    newFrag.startPTS = 1000;
    chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);
    state = new TransmuxState(false, true, true, false, 1000, false);
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      newFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    expect(stub).to.have.been.calledTwice;
    const secondCall = stub.args[1][0];
    expect(
      secondCall,
      'Demux call 2: ' + JSON.stringify(secondCall, null, 2),
    ).to.deep.include({
      cmd: 'demux',
      data,
      decryptdata: newFrag.decryptdata,
      chunkMeta,
      state,
    });
  });

  it('pushes data to demuxer with no worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;

    // Config for push
    transmuxerInterfacePrivates.frag = currentFrag;

    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 200;
    newFrag.sn = 5;
    newFrag.level = 2;
    newFrag.start = 1000;
    const part = null;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    const configureStub = sinon.stub(
      transmuxerInterfacePrivates.transmuxer,
      'configure',
    );
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      newFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    const tConfig = new TransmuxConfig('', '', initSegmentData, 0);
    const state = new TransmuxState(true, false, true, true, 1000, false);
    expect(configureStub).to.have.been.calledOnce;
    expect(configureStub).to.have.been.calledWith(tConfig);

    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(
      data,
      newFrag.decryptdata,
      chunkMeta,
      state,
    );
  });

  it('sends worker generic message', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    const triggerStub = sinon.stub(hls, 'trigger');
    triggerStub.callsFake(function (event, data) {
      expect(event).to.equal(evt.data.event);
      expect(data).to.equal(evt.data.data);
      expect(transmuxerInterfacePrivates.frag).to.equal(evt.data.data.frag);
      expect(evt.data.data.id).to.equal('main');
      return true;
    });
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterfacePrivates.frag = {};

    const evt = {
      data: {
        event: {},
        data: {},
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    } as any;

    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(triggerStub.callCount).equals(1);
  });

  it('Handles the init event', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const evt = {
      data: {
        event: 'init',
        data: {},
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    };

    const spy = sinon.spy(self.URL, 'revokeObjectURL');
    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(spy).to.have.been.calledOnce;
  });

  it('Handles logger events from the worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const evt = {
      data: {
        event: 'workerLog',
        data: {
          logType: 'log',
          message: 'testing logger',
        },
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    };

    const spy = sinon.spy(hls.logger, 'log');
    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(spy).to.have.been.calledWith(evt.data.data.message);
  });
});
