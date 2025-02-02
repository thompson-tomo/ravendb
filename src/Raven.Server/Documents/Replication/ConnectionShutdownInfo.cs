﻿using System;
using System.Collections.Generic;
using System.Linq;
using Raven.Client.Documents.Replication;
using Sparrow.Json.Parsing;

namespace Raven.Server.Documents.Replication
{
    public sealed class ConnectionShutdownInfo
    {
        private readonly TimeSpan _initialTimeout = TimeSpan.FromMilliseconds(1000);
        private readonly int _retriesCount = 0;

        public ConnectionShutdownInfo()
        {
            NextTimeout = _initialTimeout;
            RetriesCount = _retriesCount;
        }

        public string DestinationDbId;

        public long LastHeartbeatTicks;

        public double MaxConnectionTimeout;

        public readonly Queue<Exception> Errors = new Queue<Exception>();

        public TimeSpan NextTimeout { get; set; }

        public DateTime RetryOn { get; set; }

        public ReplicationNode Node { get; set; }

        public int RetriesCount { get; set; }

        public void Reset()
        {
            NextTimeout = _initialTimeout;
            RetriesCount = _retriesCount;
            Errors.Clear();
        }

        public void OnError(Exception e)
        {
            Errors.Enqueue(e);
            while (Errors.Count > 25)
                Errors.TryDequeue(out _);

            RetriesCount++;
            NextTimeout *= 2;
            NextTimeout = TimeSpan.FromMilliseconds(Math.Min(NextTimeout.TotalMilliseconds, MaxConnectionTimeout));
            RetryOn = DateTime.UtcNow + NextTimeout;
        }

        public DynamicJsonValue ToJson()
        {
            return new DynamicJsonValue
            {
                ["ErrorsCount"] = Errors.Count,
                [nameof(Errors)] = new DynamicJsonArray(Errors.Select(e => e.ToString())),
                [nameof(NextTimeout)] = NextTimeout,
                [nameof(RetryOn)] = RetryOn,
                [nameof(DestinationDbId)] = DestinationDbId,
                [nameof(LastHeartbeatTicks)] = LastHeartbeatTicks
            };
        }
    }
}
