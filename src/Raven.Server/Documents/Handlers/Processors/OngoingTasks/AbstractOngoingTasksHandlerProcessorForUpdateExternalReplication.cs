﻿using System.IO;
using System.Threading.Tasks;
using JetBrains.Annotations;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.Documents.Operations.Replication;
using Raven.Client.Json.Serialization;
using Raven.Server.Documents.Handlers.Processors.Databases;
using Raven.Server.ServerWide.Commands;
using Raven.Server.ServerWide.Context;
using Sparrow.Json;
using Sparrow.Json.Parsing;

namespace Raven.Server.Documents.Handlers.Processors.OngoingTasks
{
    internal abstract class AbstractOngoingTasksHandlerProcessorForUpdateExternalReplication<TRequestHandler, TOperationContext> : AbstractHandlerProcessorForUpdateDatabaseConfiguration<BlittableJsonReaderObject, TRequestHandler, TOperationContext>
        where TOperationContext : JsonOperationContext
        where TRequestHandler : AbstractDatabaseRequestHandler<TOperationContext>
    {
        private ExternalReplication _watcher;
        private long _taskId;
        protected AbstractOngoingTasksHandlerProcessorForUpdateExternalReplication([NotNull] TRequestHandler requestHandler) : base(requestHandler)
        {
        }

        protected abstract void FillResponsibleNode(TransactionOperationContext context, DynamicJsonValue responseJson, ExternalReplication watcher);

        protected override void OnBeforeResponseWrite(TransactionOperationContext context, DynamicJsonValue responseJson, BlittableJsonReaderObject configuration, long index)
        {
            if (_watcher == null)
            {
                if (configuration.TryGet(nameof(UpdateExternalReplicationCommand.Watcher), out BlittableJsonReaderObject watcherBlittable) == false)
                {
                    throw new InvalidDataException($"{nameof(UpdateExternalReplicationCommand.Watcher)} was not found.");
                }

                _watcher = JsonDeserializationClient.ExternalReplication(watcherBlittable);
            }

            FillResponsibleNode(context, responseJson, _watcher);
            _taskId = _watcher.TaskId == 0 ? index : _watcher.TaskId;
            responseJson[nameof(ModifyOngoingTaskResult.TaskId)] = _taskId;
        }

        protected override Task<(long Index, object Result)> OnUpdateConfiguration(TransactionOperationContext context, BlittableJsonReaderObject configuration, string raftRequestId)
        {
            return RequestHandler.ServerStore.UpdateExternalReplication(RequestHandler.DatabaseName, configuration, raftRequestId, out _watcher);
        }

        protected override ValueTask OnAfterUpdateConfiguration(TransactionOperationContext context, BlittableJsonReaderObject configuration, string raftRequestId)
        {
            RequestHandler.LogTaskToAudit(Web.RequestHandler.UpdateExternalReplicationDebugTag, _taskId, configuration);
            return ValueTask.CompletedTask;
        }
    }
}
