﻿using System;
using System.Collections.Generic;
using JetBrains.Annotations;
using Raven.Client.Documents.Operations.Backups;
using Raven.Client.Documents.Operations.ETL;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.Http;
using Raven.Client.ServerWide;
using Raven.Server.Documents.OngoingTasks;
using Raven.Server.ServerWide.Context;

namespace Raven.Server.Documents.Sharding;

public partial class ShardedDatabaseContext
{
    public AbstractOngoingTasks OngoingTasks;

    public class ShardedOngoingTasks : AbstractOngoingTasks
    {
        private readonly ShardedDatabaseContext _context;

        public ShardedOngoingTasks([NotNull] ShardedDatabaseContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        protected override IEnumerable<OngoingTaskSubscription> CollectSubscriptionTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskBackup> CollectBackupTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskRavenEtlListView> CollectRavenEtlTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskSqlEtlListView> CollectSqlEtlTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskOlapEtlListView> CollectOlapEtlTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskElasticSearchEtlListView> CollectElasticEtlTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskQueueEtlListView> CollectQueueEtlTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskPullReplicationAsSink> CollectPullReplicationAsSinkTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskPullReplicationAsHub> CollectPullReplicationAsHubTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override IEnumerable<OngoingTaskReplication> CollectExternalReplicationTasks(TransactionOperationContext context, ClusterTopology clusterTopology, DatabaseRecord databaseRecord)
        {
            throw new System.NotImplementedException();
        }

        protected override OngoingTaskConnectionStatus GetEtlTaskConnectionStatus<T>(DatabaseRecord record, EtlConfiguration<T> config, out string tag, out string error)
        {
            throw new System.NotImplementedException();
        }

        protected override (string Url, OngoingTaskConnectionStatus Status) GetReplicationTaskConnectionStatus<T>(DatabaseTopology databaseTopology, ClusterTopology clusterTopology, T replication,
            Dictionary<string, RavenConnectionString> connectionStrings, out string tag, out RavenConnectionString connection)
        {
            throw new System.NotImplementedException();
        }

        protected override PeriodicBackupStatus GetBackupStatus(long taskId, DatabaseRecord databaseRecord, PeriodicBackupConfiguration backupConfiguration, out string responsibleNodeTag,
            out NextBackup nextBackup, out RunningBackup onGoingBackup, out bool isEncrypted)
        {
            throw new System.NotImplementedException();
        }
    }
}
