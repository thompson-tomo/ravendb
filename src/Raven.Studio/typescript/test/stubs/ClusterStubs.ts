﻿import clusterTopology from "models/database/cluster/clusterTopology";
import ClusterTopologyChanged = Raven.Server.NotificationCenter.Notifications.Server.ClusterTopologyChanged;

export class ClusterStubs {
    static singleNodeTopology(): clusterTopology {
        const dto = {
            NodeTag: "A",
            Topology: {
                Members: {
                    A: "http://raven1:8080",
                },
                Watchers: {},
                Promotables: {},
                TopologyId: "5638070f-e851-4e8d-a152-e6fce343cb59",
                Etag: 1,
                AllNodes: {
                    A: "http://raven1:8080",
                },
                LastNodeId: "A",
            },
            CurrentState: "Leader",
        } as Partial<ClusterTopologyChanged>;

        return new clusterTopology(dto as ClusterTopologyChanged);
    }

    static clusterTopology(): clusterTopology {
        const dto = {
            NodeTag: "A",
            Topology: {
                Members: {
                    A: "http://raven1:8080",
                    B: "http://raven2:8080",
                    C: "http://raven3:8080",
                },
                Watchers: {},
                Promotables: {},
                TopologyId: "5638070f-e851-4e8d-a152-e6fce343cb59",
                Etag: 1,
                AllNodes: {
                    A: "http://raven1:8080",
                    B: "http://raven2:8080",
                    C: "http://raven3:8080",
                },
                LastNodeId: "A",
            },
            CurrentState: "Leader",
        } as Partial<ClusterTopologyChanged>;

        return new clusterTopology(dto as ClusterTopologyChanged);
    }
}
