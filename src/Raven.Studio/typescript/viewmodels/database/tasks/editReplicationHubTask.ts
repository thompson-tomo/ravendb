import app = require("durandal/app");
import appUrl = require("common/appUrl");
import router = require("plugins/router");
import saveReplicationHubTaskCommand = require("commands/database/tasks/saveReplicationHubTaskCommand");
import ongoingTaskReplicationHubEditModel = require("models/database/tasks/ongoingTaskReplicationHubEditModel");
import eventsCollector = require("common/eventsCollector");
import jsonUtil = require("common/jsonUtil");
import getReplicationHubTaskInfoCommand = require("commands/database/tasks/getReplicationHubTaskInfoCommand");
import generateCertificateForReplicationCommand = require("commands/database/tasks/generateCertificateForReplicationCommand");
import replicationCertificateModel = require("models/database/tasks/replicationCertificateModel");
import messagePublisher = require("common/messagePublisher");
import fileDownloader = require("common/fileDownloader");
import forge = require("node-forge");
import clusterTopologyManager = require("common/shell/clusterTopologyManager");
import generateReplicationCertificateConfirm = require("viewmodels/database/tasks/generateReplicationCertificateConfirm");
import fileImporter = require("common/fileImporter");
import replicationAccessHubModel = require("models/database/tasks/replicationAccessHubModel");
import saveReplicationHubAccessConfigCommand = require("commands/database/tasks/saveReplicationHubAccessConfigCommand");
import popoverUtils = require("common/popoverUtils");
import getReplicationHubAccessCommand = require("commands/database/tasks/getReplicationHubAccessCommand");
import prefixPathModel = require("models/database/tasks/prefixPathModel");
import deleteReplicationHubAccessConfigCommand = require("commands/database/tasks/deleteReplicationHubAccessConfigCommand");
import genUtils = require("common/generalUtils");
import certificateUtils = require("common/certificateUtils");
import viewHelpers = require("common/helpers/view/viewHelpers");
import accessManager = require("common/shell/accessManager");
import shardViewModelBase from "viewmodels/shardViewModelBase";
import database from "models/resources/database";
import DatabaseUtils from "components/utils/DatabaseUtils";
import licenseModel from "models/auth/licenseModel";
import { EditReplicationHubInfoHub } from "viewmodels/database/tasks/EditReplicationHubInfoHub";

class editReplicationHubTask extends shardViewModelBase {

    view = require("views/database/tasks/editReplicationHubTask.html");
    pinResponsibleNodeButtonsScriptView = require("views/partial/pinResponsibleNodeButtonsScript.html");
    pinResponsibleNodeTextScriptView = require("views/partial/pinResponsibleNodeTextScript.html");
    
    editedHubTask = ko.observable<ongoingTaskReplicationHubEditModel>();
    editedReplicationAccessItem = ko.observable<replicationAccessHubModel>(null);

    private taskId: number = null;
    isNewTask = ko.observable<boolean>(true);
    
    canDefineCertificates = accessManager.default.secureServer();
    
    possibleMentors = ko.observableArray<string>([]);

    showAccessDetails = ko.observable<boolean>(false);
    
    spinners = { 
        saveHubTask: ko.observable<boolean>(false),
        saveReplicationAccess: ko.observable<boolean>(false),
        generateCertificate: ko.observable<boolean>(false)
    };

    hasPullReplicationAsHub = licenseModel.getStatusValue("HasPullReplicationAsHub");

    infoHubView: ReactInKnockout<typeof EditReplicationHubInfoHub>;

    allReplicationAccessItems = ko.observableArray<replicationAccessHubModel>([]);
    visibleReplicationAccessItems: KnockoutComputed<Array<replicationAccessHubModel>>;
    filteredReplicationAccessItems: KnockoutComputed<Array<replicationAccessHubModel>>;
    
    filterText = ko.observable<string>();
    
    readonly accessItemsBatch = 50;
    batchCounter = ko.observable<number>(0);
    showLoadMore: KnockoutComputed<boolean>;

    constructor(db: database) {
        super(db);
        
        this.bindToCurrentInstance("generateCertificate", "uploadCertificate", "downloadCertificate", "removeCertificate",
                                   "exportHubConfiguration", "exportAccessConfiguration",
                                   "cancelHubTaskOperation", "cancelReplicationAccessOperation",
                                   "addNewReplicationAccess", "editReplicationAccessItem", 
                                   "cloneReplicationAccessItem","deleteReplicationAccessItem",
                                   "saveReplicationHubTask", "saveReplicationAccessItem", "loadMoreAccessItems", "setState");
        this.infoHubView = ko.pureComputed(() => ({
            component: EditReplicationHubInfoHub
        }))
    }

    activate(args: any) {
        super.activate(args);
        const deferredHubTaskInfo = $.Deferred<void>();
        const deferredAccessInfo = $.Deferred<void>();
        
        this.loadPossibleMentors();

        if (args.taskId) {
            // 1. Editing an existing task
            this.isNewTask(false);
            this.taskId = args.taskId;
            
            new getReplicationHubTaskInfoCommand(this.db, this.taskId)
                .execute()
                .done((hubResult: Raven.Client.Documents.Operations.Replication.PullReplicationDefinitionAndCurrentConnections) => {
                    this.editedHubTask(new ongoingTaskReplicationHubEditModel(hubResult.Definition));
                    deferredHubTaskInfo.resolve();
                    
                    new getReplicationHubAccessCommand(this.db, this.editedHubTask().taskName())
                        .execute()
                        .done((accessResult: Raven.Client.Documents.Operations.Replication.ReplicationHubAccessResult) => {
                            this.processResults(accessResult);
                            deferredAccessInfo.resolve();
                        })
                        .fail(() => {
                            deferredAccessInfo.reject();
                            router.navigate(appUrl.forOngoingTasks(this.db));
                        });
                })
                .fail(() => {
                    deferredHubTaskInfo.reject();
                    router.navigate(appUrl.forOngoingTasks(this.db));
                });

        } else {
            // 2. Creating a new task
            this.isNewTask(true);
            this.editedHubTask(ongoingTaskReplicationHubEditModel.empty());
            deferredHubTaskInfo.resolve();
        }

        deferredHubTaskInfo.done(() => this.initObservables());

        if (args.taskId) {
            return $.when<any>(deferredHubTaskInfo, deferredAccessInfo);
        }
        
        return $.when<any>(deferredHubTaskInfo);
    }

    private processResults(accessResult: Raven.Client.Documents.Operations.Replication.ReplicationHubAccessResult) {
        const accessItems = accessResult.Results.map(x => {
            
            const certificate = new replicationCertificateModel(x.Certificate);
            const h2sPaths = x.AllowedHubToSinkPaths.map(x => new prefixPathModel(x));
            const s2hPaths = x.AllowedSinkToHubPaths.map(x => new prefixPathModel(x));
           
            return new replicationAccessHubModel(x.Name, certificate, h2sPaths, s2hPaths, this.editedHubTask().withFiltering(), false);
        });

        this.allReplicationAccessItems(accessItems);
    }
    
    attached() {
        super.attached();

        popoverUtils.longWithHover($("#replication-filtering-info"),
            {
                content:
                    "<ul class='margin-bottom margin-bottom-xs'>" +
                        "<li><small>Check this toggle in order to be able to define filtering on this Replication Hub task.</small></li>" +
                        "<li><small>You will be able to define the replication filtering when editing the task after saving this configuration.</small></li>" +
                        "<li><small class='text-warning'><i class='icon-warning'></i>" +
                            "<span>Note: This parameter cannot be modified after saving this configuration.</span></small>" +
                        "</li>" +
                    "</ul>"
            });
    }

    private loadPossibleMentors() {
        const members = this.db.nodes()
            .filter(x => x.type === "Member")
            .map(x => x.tag);

        this.possibleMentors(members);
    }

    private initObservables() {
        this.filteredReplicationAccessItems = ko.pureComputed(() => {
            let items = this.allReplicationAccessItems();
            
            const filter = this.filterText();
            if (filter) {
                const upperFilter = filter.toUpperCase();
                items = items.filter(x => x.replicationAccessName().toUpperCase().includes(upperFilter) ||
                                     x.certificate().thumbprint().includes(upperFilter));
            }
            
            return items;
        });
        
        this.visibleReplicationAccessItems = ko.pureComputed(() => {
            const items = this.filteredReplicationAccessItems();
            
            const numberOfItemsToShow = this.batchCounter() * this.accessItemsBatch;
            return items.slice(0, numberOfItemsToShow);
        });
        
        this.showLoadMore = ko.pureComputed(() => {
            const visibleAccessItemsCount = this.visibleReplicationAccessItems().length;
            const allAccessItemsCount = this.allReplicationAccessItems().length;

            return visibleAccessItemsCount > 0 &&
                   visibleAccessItemsCount < allAccessItemsCount &&
                   visibleAccessItemsCount >= this.accessItemsBatch;
        });
        
        const model = this.editedHubTask();
        
        this.dirtyFlag = new ko.DirtyFlag([
            model.taskName,
            model.disabled,
            model.manualChooseMentor,
            model.mentorNode,
            model.pinMentorNode,
            model.delayReplicationTime,
            model.showDelayReplication,
            model.preventDeletions,
            model.withFiltering,
            model.allowReplicationFromHubToSink,
            model.allowReplicationFromSinkToHub
        ], false, jsonUtil.newLineNormalizingHashFunction)
    }

    compositionComplete() {
        super.compositionComplete();
        if (this.hasPullReplicationAsHub) {
            document.getElementById('taskName').focus();
        }
        
        $('.edit-pull-replication-hub-task [data-toggle="tooltip"]').tooltip();
    }

    saveReplicationHubTask() {
        if (!this.isValid(this.editedHubTask().validationGroupForSave)) {
            return;
        }

        this.spinners.saveHubTask(true);

        const dto = this.editedHubTask().toDto(this.taskId);
        this.taskId = this.isNewTask() ? 0 : this.taskId;

        eventsCollector.default.reportEvent("pull-replication-hub", "save");

        new saveReplicationHubTaskCommand(this.db, dto)
            .execute()
            .done((result: Raven.Client.Documents.Operations.OngoingTasks.ModifyOngoingTaskResult) => {
                this.dirtyFlag().reset();
               
                if (this.isNewTask() && this.canDefineCertificates) {
                    // don't navigate back to list, allow user to add replication access
                    this.isNewTask(false);
                    this.taskId = result.TaskId;
                    this.addNewReplicationAccess();
                } else {
                    this.goToOngoingTasksView();
                }
                
            })
            .always(() => this.spinners.saveHubTask(false));
    }

    saveReplicationAccessItem() {
        const accessValidation = this.editedReplicationAccessItem().getValidationGroupForSave(this.editedHubTask().withFiltering());
        if (!this.isValid(accessValidation)) {
            return
        }

        this.spinners.saveReplicationAccess(true);
        
        // if samePrefixes then use h2s prefixes for both
        if (this.editedReplicationAccessItem().samePrefixesForBothDirections()) {
            this.editedReplicationAccessItem().sinkToHubPrefixes(this.editedReplicationAccessItem().hubToSinkPrefixes());
        }
             
        new saveReplicationHubAccessConfigCommand(this.db, 
            this.editedHubTask().taskName(), this.editedReplicationAccessItem().toDto())
            .execute()
            .done(() => {
                new getReplicationHubAccessCommand(this.db, this.editedHubTask().taskName())
                    .execute()
                    .done((accessResult: Raven.Client.Documents.Operations.Replication.ReplicationHubAccessResult) => {
                        this.processResults(accessResult);
                        this.editedReplicationAccessItem(null);
                    });
            })
            .always(() => this.spinners.saveReplicationAccess(false));
    } 
   
    cancelHubTaskOperation() {
        this.goToOngoingTasksView();
    }
    
    cancelReplicationAccessOperation() {
        this.editedReplicationAccessItem(null);
        this.spinners.generateCertificate(false);
    }  

    addNewReplicationAccess() {
        if (this.editedReplicationAccessItem() && this.editedReplicationAccessItem().dirtyFlag().isDirty()) {
            this.warnAboutUnsavedChanges()
                .done(result => {
                    if (result.can) {
                        this.addItem();
                    }
                });
        } else {
            this.addItem();
        }
    }
    
    addItem() {
        this.editedReplicationAccessItem(replicationAccessHubModel.empty(this.editedHubTask().withFiltering()));
        this.initTooltips();
    }
   
    editReplicationAccessItem(replicationAcessItem: replicationAccessHubModel) {
        if (this.editedReplicationAccessItem() && this.editedReplicationAccessItem().dirtyFlag().isDirty()) {
            this.warnAboutUnsavedChanges()
                .done(result => {
                    if (result.can) {
                        this.editItem(replicationAcessItem);
                    }
                });
        } else {
            this.editItem(replicationAcessItem);
        }
    }
   
    editItem(replicationAcessItem: replicationAccessHubModel) {
        // work on a copy, not on original
        const copyOfAccessItem = replicationAccessHubModel.clone(replicationAcessItem);
        this.editedReplicationAccessItem(copyOfAccessItem);

        this.initTooltips();
    }
    
    cloneReplicationAccessItem() {
        if (this.editedReplicationAccessItem().dirtyFlag().isDirty()) {
            this.warnAboutUnsavedChanges()
                .done(result => {
                    if (result.can) {
                        this.cloneItem();
                    }
                });
        } else {
            this.cloneItem();
        }
    }

    cloneItem() {
        const editedItem = this.editedReplicationAccessItem();
        const cloneItem = new replicationAccessHubModel("", null, editedItem.hubToSinkPrefixes(), editedItem.sinkToHubPrefixes(), editedItem.filteringPathsRequired());
        this.editedReplicationAccessItem(cloneItem);
        this.initTooltips();
    }

    warnAboutUnsavedChanges() {
        return this.confirmationMessage("Unsaved changes",
            "You have unsaved changes. How do you want to proceed?",
            { buttons: ["Cancel", "Continue"] })
    }

    deleteReplicationAccessItem(accessItemToDelete: replicationAccessHubModel) {
        this.confirmationMessage("Are you sure?",
            `Delete Replication Access <strong>${genUtils.escapeHtml(accessItemToDelete.replicationAccessName())}</strong>?`, {
                buttons: ["Cancel", "Delete"],
                html: true
            })
            .done(result => {
                if (result.can) {
                    new deleteReplicationHubAccessConfigCommand(this.db,
                        this.editedHubTask().taskName(), accessItemToDelete.certificate().thumbprint())
                        .execute()
                        .done(() => {
                            new getReplicationHubAccessCommand(this.db, this.editedHubTask().taskName())
                                .execute()
                                .done((accessResult: Raven.Client.Documents.Operations.Replication.ReplicationHubAccessResult) => {
                                    this.processResults(accessResult);
                                });
                        })
                }
            });
    }

    private goToOngoingTasksView() {
        router.navigate(appUrl.forOngoingTasks(this.db));
    }
    
    private initTooltips() {
        this.setupDisableReasons();

        const uploadCertificateSelector = "#upload-certificate";
        $(uploadCertificateSelector).on("click", function () {
            $(this).tooltip("hide");
        })
        
        popoverUtils.longWithHover($(uploadCertificateSelector),
            {
                content: "<small>Upload your own certificate (<strong>Public key</strong>)</small>",
                trigger: "hover"
            });
        
        popoverUtils.longWithHover($("#generate-certificate"),
            {
                content: "<small>RavenDB will generate a certificate for you (<strong>Public & private keys</strong>)</small>"
            });
        
        popoverUtils.longWithHover($("#hub-to-sink-info"),
            {
                content:
                    "<ul class='no-margin padding'>" +
                        "<li><small>These ID paths define <strong>what docments are allowed to be sent from the Hub.</strong></small></li>" +
                        "<li><small>You can further restrict this list when defining a Sink task that receives data from this Hub.</small></li>" +
                        "<li><small>To send all documents under some path use <code>&lt;path&gt;/*</code> or <code>&lt;path&gt;-*</code></small></li>" +
                    "</ul>"
            });

        popoverUtils.longWithHover($("#sink-to-hub-info"),
            {
                content:
                    "<ul class='no-margin padding'>" +
                        "<li><small>These ID paths define <strong>what docments are allowed to be sent to this Hub.</strong></small></li>" +
                        "<li><small>You can further restrict this list when defining a Sink task that sends data to this Hub.</small></li>" +
                        "<li><small>To send all documents under some path use <code>&lt;path&gt;/*</code> or <code>&lt;path&gt;-*</code></small></li>" +
                    "</ul>"
            });
    }

    uploadCertificate(fileInput: HTMLInputElement): void {
        fileImporter.readAsBinaryString(fileInput, data => this.onCertificateUploaded(data));
    }

    private onCertificateUploaded(data: string): void {
        const accessItem = this.editedReplicationAccessItem();
        let certificateModel: replicationCertificateModel;
        
        try {
            // First detect the data format, pfx (binary) or crt/cer (text)
            // The line bellow will throw if data is not pfx
            forge.asn1.fromDer(data);
            
            // *** Handle pfx ***
            
            const errMsg = "The .pfx file uploaded contains multiple certificates. <br>" +
                "Extract each certificate and upload a single certificate per Replication Access Item.<br><br>" +
                "i.e. If your Sink task spans multiple RavenDb nodes, each having a different certificate, " +
                "then the Hub task must be defined with multiple Replication Access Items, one per certificate.";
            
            try {
                const certAsBase64 = forge.util.encode64(data);
                const certificatesArray = certificateUtils.extractCertificatesFromPkcs12(certAsBase64, undefined);

                if (certificatesArray.length > 1) {
                    viewHelpers.confirmationMessage("Multiple certificates", errMsg, {html: true, buttons: ["Ok"]});
                } else {
                    const publicKey = certificatesArray[0];
                    certificateModel =  new replicationCertificateModel(publicKey, certAsBase64);
                }
            } catch ($ex1) {
                messagePublisher.reportError("Unable to upload certificate", $ex1);
            }
            
        } catch {
            // *** Handle crt/cer ***
            try {
                certificateModel = new replicationCertificateModel(data);
            } catch ($ex2) {
                messagePublisher.reportError("Unable to upload certificate", $ex2);
            }
        }
        
        if (certificateModel) {
            accessItem.certificate(certificateModel);
            accessItem.usingExistingCertificate(true);
        }
    }
    
    generateCertificate() {
        app.showBootstrapDialog(new generateReplicationCertificateConfirm())
            .done(validity => {
                if (validity != null) {
                    this.spinners.generateCertificate(true);
                    const editedItemBefore = this.editedReplicationAccessItem();
                    
                    new generateCertificateForReplicationCommand(this.db, validity)
                        .execute()
                        .done(result => {
                            const editedItemAfter = this.editedReplicationAccessItem();
                            
                            if (editedItemBefore === editedItemAfter) {
                                this.editedReplicationAccessItem().certificate(new replicationCertificateModel(result.PublicKey, result.Certificate));
                               
                                // reset the 'saving certificate' status
                                this.editedReplicationAccessItem().accessConfigurationWasExported(false);
                                this.editedReplicationAccessItem().certificateWasDownloaded(false);
                                this.editedReplicationAccessItem().usingExistingCertificate(false);
                            }
                        })
                        .always(() => this.spinners.generateCertificate(false));
                }
            });
    }
    
    exportHubConfiguration() {
        if (!this.isValid(this.editedHubTask().validationGroupForExport)) {
            return;
        }
        
        this.exportConfiguration();
    }

    exportAccessConfiguration() {
        if (!this.isValid(this.editedHubTask().validationGroupForExport)) {
            return;
        }
        
        const accessValidation = this.editedReplicationAccessItem().getValidationGroupForExport(this.editedHubTask().withFiltering());
        if (!this.isValid(accessValidation)) {
            return
        }
        
        this.exportConfiguration(true);
        this.editedReplicationAccessItem().accessConfigurationWasExported(true);
    }
    
    exportConfiguration(includeAccessInfo = false) {
        const hubTaskItem = this.editedHubTask();
        const databaseName = this.db.name;
        const topologyUrls = clusterTopologyManager.default.topology().nodes().map(x => x.serverUrl());

        const configurationToExport = {
            Database: databaseName,
            HubName: hubTaskItem.taskName(),
            TopologyUrls: topologyUrls,
            AllowHubToSinkMode: hubTaskItem.allowReplicationFromHubToSink(),
            AllowSinkToHubMode: hubTaskItem.allowReplicationFromSinkToHub()
        } as pullReplicationExportFileFormat;
        
        if (includeAccessInfo) {
            const replicationAccessItem = this.editedReplicationAccessItem();
            configurationToExport.AccessName = replicationAccessItem.replicationAccessName();
            
            // if certificate was Generated: export both public & private key
            // if certificate was Imported:  export 'null'
            const certificate = replicationAccessItem.certificate().certificate();
            configurationToExport.Certificate = certificate || null;

            configurationToExport.HubToSinkPrefixes = replicationAccessItem.hubToSinkPrefixes().map(x => x.path());
            
            if (this.editedReplicationAccessItem().samePrefixesForBothDirections()) {
                configurationToExport.UseSamePrefixes = true;
            } else {
                configurationToExport.UseSamePrefixes = false;
                configurationToExport.SinkToHubPrefixes = replicationAccessItem.sinkToHubPrefixes().map(x => x.path());
            }
        }

        let fileName = includeAccessInfo ? "hubAccessConfiguration" : "hubConfiguration";
        const accessName = includeAccessInfo ? this.editedReplicationAccessItem().replicationAccessName() + "-" : "";
        const detailedDatabaseName = DatabaseUtils.formatNameForFile(databaseName, this.location);
        
        fileName = `${fileName}-${hubTaskItem.taskName()}-${accessName}${detailedDatabaseName}.json`;
        
        fileDownloader.downloadAsJson(configurationToExport, fileName);
    }

    downloadCertificate() {
        // download both public & private key (when certificated was Generated by us)
        const certificate = this.editedReplicationAccessItem().certificate();
        
        if (certificate) {
            const pfx = forge.util.binary.base64.decode(certificate.certificate());
            const fileName = "replicationCertificate" + certificate.thumbprint().substr(0, 8) + ".pfx";
            
            fileDownloader.downloadAsTxt(pfx, fileName);
            
            this.editedReplicationAccessItem().certificateWasDownloaded(true);
        }
    }
    
    removeCertificate() {
        this.editedReplicationAccessItem().certificate(null);
    }
    
    loadMoreAccessItems() {
        this.batchCounter(this.batchCounter() + 1);
    }

    setState(state: Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskState): void {
        this.editedHubTask().disabled(state === "Disabled");
    }
}

export = editReplicationHubTask;
