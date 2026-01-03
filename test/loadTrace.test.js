const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const fs = require('fs');

describe('loadTraceFromWorkspace', () => {
  let fakeVscode;
  let extension;
  let showErrorStub;

  beforeEach(() => {
    showErrorStub = sinon.stub();
    fakeVscode = {
      workspace: { workspaceFolders: undefined },
      window: {
        showErrorMessage: showErrorStub,
        createOutputChannel: () => ({ appendLine: () => {} })
      }
    };

    extension = proxyquire('../extension', { vscode: fakeVscode });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns empty when no workspace', () => {
    const res = extension.loadTraceFromWorkspace();
    expect(res).to.have.property('snapshots').with.length(0);
    expect(showErrorStub.called).to.be.true;
  });

  it('returns empty when output.json missing', () => {
    fakeVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/work' } }];
    const existsStub = sinon.stub(fs, 'existsSync').callsFake((p) => false);

    const res = extension.loadTraceFromWorkspace();
    expect(res.snapshots).to.be.an('array').that.is.empty;
    expect(showErrorStub.called).to.be.true;
    existsStub.restore();
  });

  it('parses array-style output.json', () => {
    fakeVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/work' } }];
    const fakeJson = JSON.stringify([{ a: 1 }, { b: 2 }]);
    sinon.stub(fs, 'existsSync').callsFake((p) => true);
    sinon.stub(fs, 'readFileSync').callsFake((p, enc) => fakeJson);

    const res = extension.loadTraceFromWorkspace();
    expect(res.snapshots).to.deep.equal([{ a: 1 }, { b: 2 }]);
  });
});
