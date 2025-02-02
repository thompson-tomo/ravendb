using System;
using System.Collections.Generic;
using Raven.Client;
using Raven.Server.ServerWide.Context;
using Sparrow.Json;
using Sparrow.Logging;
using Voron;
using Sparrow.Json.Parsing;
using Voron.Impl;

namespace Raven.Server.Documents.DataArchival;

public sealed class DataArchivalStorage : AbstractBackgroundWorkStorage
{
    private const string DocumentsByArchiveAtDateTime = "DocumentsByArchiveAtDateTime";

    public DataArchivalStorage(DocumentDatabase database, Transaction tx)
        : base(tx, database, LoggingSource.Instance.GetLogger<DataArchivalStorage>(database.Name), DocumentsByArchiveAtDateTime, Constants.Documents.Metadata.ArchiveAt)
    {
    }

    protected override void ProcessDocument(DocumentsOperationContext context, Slice lowerId, string id, DateTime currentTime)
    {
        if (id == null)
            throw new InvalidOperationException($"Couldn't archive the document. Document id is null. Lower id is {lowerId}");

        using (var doc = Database.DocumentsStorage.Get(context, lowerId, DocumentFields.Data, throwOnConflict: true))
        {
            if (doc == null || doc.TryGetMetadata(out var metadata) == false)
                return;

            if (HasPassed(metadata, currentTime, MetadataPropertyName) == false)
                return;

            // Add archived flag, remove archive timestamp, add document flag
            metadata.Modifications = new DynamicJsonValue(metadata);
            metadata.Modifications[Constants.Documents.Metadata.Archived] = true;
            metadata.Modifications.Remove(Constants.Documents.Metadata.ArchiveAt);
            doc.Flags |= DocumentFlags.Archived;


            using (var updated = context.ReadObject(doc.Data, id, BlittableJsonDocumentBuilder.UsageMode.ToDisk))
            {
                Database.DocumentsStorage.Put(context, id, null, updated, flags: doc.Flags.Strip(DocumentFlags.FromClusterTransaction));
            }
        }
    }

    protected override void HandleDocumentConflict(BackgroundWorkParameters options, Slice clonedId, ref int totalCount, ref List<(Slice LowerId, string Id)> docsToProcess)
    {
        // data archival ignores conflicts
    }
}
