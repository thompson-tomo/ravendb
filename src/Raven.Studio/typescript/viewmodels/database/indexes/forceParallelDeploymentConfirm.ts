import dialogViewModelBase = require("viewmodels/dialogViewModelBase");

class forceParallelDeploymentConfirm extends dialogViewModelBase {
    view = require("views/database/indexes/forceParallelDeploymentConfirm.html");
    /*

    TODO:
    
    localNodeTag: string;
    indexName: string;
    canForceCurrentNode: boolean;
    
    constructor(progress: indexProgress, localNodeTag: string, private db: database) {
        super();
        
        this.indexName = progress.name;
        this.localNodeTag = localNodeTag;
        this.canForceCurrentNode = progress.rollingProgress().find(x => x.nodeTag === localNodeTag).state() !== "Done";
    }

    forceDeploymentMode(currentNodeOnly: boolean) {
        new finishRollingCommand(this.db, this.indexName, currentNodeOnly ? this.localNodeTag : null)
            .execute();

        dialog.close(this);
    }

    cancel() {
        dialog.close(this);
    }*/
}

export = forceParallelDeploymentConfirm;
