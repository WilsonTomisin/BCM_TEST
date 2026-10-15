<?php
// Minimal harness theme: every front-end request renders the Q1 listing.
?><!doctype html><html><head><meta charset="utf-8"><title>Q1</title><?php wp_head(); ?></head><body>
<?php get_template_part( 'search-listing' ); ?>
<?php wp_footer(); ?></body></html>
