﻿// -----------------------------------------------------------------------
//  <copyright file="RavenDB921.cs" company="Hibernating Rhinos LTD">
//      Copyright (c) Hibernating Rhinos LTD. All rights reserved.
//  </copyright>
// -----------------------------------------------------------------------

using System.Linq;
using System.Threading.Tasks;
using FastTests;
using Raven.Client;
using Raven.Client.Documents;
using Raven.Client.Documents.Indexes;
using Raven.Client.Documents.Operations.Indexes;
using Tests.Infrastructure;
using Xunit;
using Xunit.Abstractions;

namespace SlowTests.Issues
{
    public class RavenDB937 : RavenTestBase
    {
        public RavenDB937(ITestOutputHelper output) : base(output)
        {
        }

        private class User
        {
            public bool Active { get; set; }
        }

        private class Users_ByActive : AbstractIndexCreationTask<User>
        {
            public Users_ByActive()
            {
                Map = users => from u in users
                               select new
                               {
                                   u.Active
                               };
            }
        }

        [Theory]
        [RavenData(SearchEngineMode = RavenSearchEngineMode.All, DatabaseMode = RavenDatabaseMode.All)]
        public async Task LowLevelRemoteStreamAsync(Options options)
        {
            using (var store = GetDocumentStore(options))
            {
                new Users_ByActive().Execute(store);

                using (var session = store.OpenSession())
                {
                    for (int i = 0; i < 1500; i++)
                    {
                        session.Store(new User());
                    }
                    session.SaveChanges();
                }

                Indexes.WaitForIndexing(store);

                using (var session = store.OpenAsyncSession())
                {
                    await using var enumerator = await session.Advanced
                        .StreamAsync(session.Query<User, Users_ByActive>().OrderBy(Constants.Documents.Indexing.Fields.DocumentIdFieldName));

                    var count = 0;
                    while (await enumerator.MoveNextAsync())
                    {
                        count++;
                    }

                    Assert.Equal(1500, count);
                }
            }
        }

        [Theory]
        [RavenData(SearchEngineMode = RavenSearchEngineMode.All, DatabaseMode = RavenDatabaseMode.All)]
        public async Task HighLevelRemoteStreamAsync(Options options)
        {
            using (var store = GetDocumentStore(options))
            {
                new Users_ByActive().Execute(store);

                using (var session = store.OpenSession())
                {
                    for (int i = 0; i < 1500; i++)
                    {
                        session.Store(new User());
                    }
                    session.SaveChanges();
                }

                Indexes.WaitForIndexing(store);

                using (var session = store.OpenAsyncSession())
                {
                    await using var enumerator = await session.Advanced.StreamAsync(session.Query<User>(new Users_ByActive().IndexName));
                    int count = 0;
                    while (await enumerator.MoveNextAsync())
                    {
                        Assert.IsType<User>(enumerator.Current.Document);
                        count++;
                    }

                    Assert.Equal(1500, count);
                }
            }
        }

        [Theory]
        [RavenData(SearchEngineMode = RavenSearchEngineMode.All, DatabaseMode = RavenDatabaseMode.All)]
        public async Task HighLevelLocalStreamWithFilterAsync(Options options)
        {
            using (var store = GetDocumentStore(options))
            {
                store.Maintenance.Send(new PutIndexesOperation(new IndexDefinition
                {
                    Name = "Users/ByActive",
                    Maps = { "from u in docs.Users select new { u.Active}" }
                }));

                using (var session = store.OpenSession())
                {
                    for (int i = 0; i < 3000; i++)
                    {
                        session.Store(new User
                        {
                            Active = i % 2 == 0
                        });
                    }
                    session.SaveChanges();
                }

                Indexes.WaitForIndexing(store);

                using (var session = store.OpenAsyncSession())
                {
                    var query = session.Query<User>("Users/ByActive")
                                       .Where(x => x.Active);
                    await using var enumerator = await session.Advanced.StreamAsync(query);
                    int count = 0;
                    while (await enumerator.MoveNextAsync())
                    {
                        Assert.IsType<User>(enumerator.Current.Document);
                        count++;
                    }

                    Assert.Equal(1500, count);
                }
            }
        }
        
        [Theory]
        [RavenData(SearchEngineMode = RavenSearchEngineMode.All, DatabaseMode = RavenDatabaseMode.All)]
        public async Task LowLevelEmbeddedStreamAsync(Options options)
        {
            using (var store = GetDocumentStore(options))
            {
                new Users_ByActive().Execute(store);

                using (var session = store.OpenSession())
                {
                    for (int i = 0; i < 1500; i++)
                    {
                        session.Store(new User());
                    }
                    session.SaveChanges();
                }

                Indexes.WaitForIndexing(store);
                using (var session = store.OpenAsyncSession())
                {
                    await using var enumerator = await session.Advanced
                        .StreamAsync(session.Query<User, Users_ByActive>().OrderBy(Constants.Documents.Indexing.Fields.DocumentIdFieldName));
                    var count = 0;
                    while (await enumerator.MoveNextAsync())
                    {
                        count++;
                    }

                    Assert.Equal(1500, count);
                }
            }
        }
    }
}
