// Cloudflare Worker — R2 upload proxy for Laneway recordings
// Binds to R2 bucket via wrangler.toml, authenticates via X-API-Key secret

export default {
  async fetch(request, env) {
    // CORS headers for extension requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Authenticate every non-OPTIONS request
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /list — list all recordings in the bucket
      if (request.method === 'GET' && path === '/list') {
        const listed = await env.RECORDINGS_BUCKET.list();
        const files = listed.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
        }));
        return Response.json({ files }, { headers: corsHeaders });
      }

      // PUT /recordings/<key> — upload a recording blob to R2
      if (request.method === 'PUT' && path.startsWith('/recordings/')) {
        const key = path.slice(1); // e.g. "recordings/local-123.webm"

        if (!key || key === 'recordings/') {
          return Response.json(
            { error: 'Missing recording key in URL path' },
            { status: 400, headers: corsHeaders }
          );
        }

        const blob = await request.arrayBuffer();
        if (!blob || blob.byteLength === 0) {
          return Response.json(
            { error: 'Empty request body' },
            { status: 400, headers: corsHeaders }
          );
        }

        await env.RECORDINGS_BUCKET.put(key, blob, {
          httpMetadata: {
            contentType: request.headers.get('Content-Type') || 'video/webm',
          },
        });

        return Response.json(
          { success: true, key, size: blob.byteLength },
          { status: 200, headers: corsHeaders }
        );
      }

      // PUT /participant-data/<key> — upload participant JSON to R2
      if (request.method === 'PUT' && path.startsWith('/participant-data/')) {
        const key = path.slice(1); // e.g. "participant-data/local-123.json"

        if (!key || key === 'participant-data/') {
          return Response.json(
            { error: 'Missing participant data key in URL path' },
            { status: 400, headers: corsHeaders }
          );
        }

        const body = await request.arrayBuffer();
        if (!body || body.byteLength === 0) {
          return Response.json(
            { error: 'Empty request body' },
            { status: 400, headers: corsHeaders }
          );
        }

        await env.RECORDINGS_BUCKET.put(key, body, {
          httpMetadata: {
            contentType: 'application/json',
          },
        });

        return Response.json(
          { success: true, key, size: body.byteLength },
          { status: 200, headers: corsHeaders }
        );
      }

      // GET /participant-data/<key> — retrieve participant JSON from R2
      if (request.method === 'GET' && path.startsWith('/participant-data/')) {
        const key = path.slice(1);

        if (!key || key === 'participant-data/') {
          return Response.json(
            { error: 'Missing participant data key in URL path' },
            { status: 400, headers: corsHeaders }
          );
        }

        const object = await env.RECORDINGS_BUCKET.get(key);
        if (!object) {
          return Response.json(
            { error: 'Not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return new Response(object.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // ─── Analytics endpoints (D1) ───

      // POST /analytics — store an analytics snapshot
      if (request.method === 'POST' && path === '/analytics') {
        const body = await request.json();
        const meetingId = body.meeting_id || body.meetingId;
        const timestamp = body.timestamp || new Date().toISOString();

        if (!meetingId) {
          return Response.json(
            { error: 'Missing meeting_id' },
            { status: 400, headers: corsHeaders }
          );
        }

        await env.ANALYTICS_DB.prepare(
          'INSERT INTO meeting_analytics (meeting_id, timestamp, data) VALUES (?, ?, ?)'
        ).bind(meetingId, timestamp, JSON.stringify(body)).run();

        return Response.json(
          { success: true, meeting_id: meetingId },
          { headers: corsHeaders }
        );
      }

      // GET /analytics/meetings — list all meetings with snapshot counts
      if (request.method === 'GET' && path === '/analytics/meetings') {
        const { results } = await env.ANALYTICS_DB.prepare(
          `SELECT meeting_id,
                  COUNT(*) AS snapshot_count,
                  MIN(created_at) AS first_seen,
                  MAX(created_at) AS last_seen
           FROM meeting_analytics
           GROUP BY meeting_id
           ORDER BY last_seen DESC`
        ).all();

        return Response.json({ meetings: results }, { headers: corsHeaders });
      }

      // GET /analytics/meetings/:id — get all snapshots for a meeting
      if (request.method === 'GET' && path.startsWith('/analytics/meetings/')) {
        const meetingId = decodeURIComponent(path.slice('/analytics/meetings/'.length));

        if (!meetingId) {
          return Response.json(
            { error: 'Missing meeting ID' },
            { status: 400, headers: corsHeaders }
          );
        }

        const { results } = await env.ANALYTICS_DB.prepare(
          'SELECT id, meeting_id, timestamp, data, created_at FROM meeting_analytics WHERE meeting_id = ? ORDER BY created_at ASC'
        ).bind(meetingId).all();

        // Parse the JSON data field for each row
        const snapshots = results.map(row => ({
          ...row,
          data: JSON.parse(row.data),
        }));

        return Response.json(
          { meeting_id: meetingId, snapshots },
          { headers: corsHeaders }
        );
      }

      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders }
      );
    } catch (err) {
      console.error('Worker error:', err);
      return Response.json(
        { error: 'Internal server error', message: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
