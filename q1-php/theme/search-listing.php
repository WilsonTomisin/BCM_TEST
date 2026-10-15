<?php
/**
 * Q1 – Paginated post listing with search and [ad] placeholders.
 * Assumes PHP 8 inside a WordPress theme template (e.g. search.php).
 */

// 1. Read and sanitise input. Missing params fall back to defaults (no PHP 8 "undefined key" warnings).
$page   = max( 1, absint( wp_unslash( $_GET['page'] ?? 1 ) ) );
$search = sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) );

// 2. `new` is required; WP_Query paginates with `paged`, not `page`.
$args = [
	'post_type'           => 'post',    // without this a search also returns pages/attachments
	'post_status'         => 'publish',
	'posts_per_page'      => 10,
	'paged'               => $page,
	'ignore_sticky_posts' => true,      // keep exactly 10 per page
];
if ( '' !== $search ) {
	$args['s'] = $search;               // only search when a term was given
}
$q = new WP_Query( $args );

$pages    = max( 1, (int) $q->max_num_pages );
$ad_index = 0; // page-wide counter so every ad slot gets a unique class
?>
<h1>
	Page <?= esc_html( $page ) ?> of <?= esc_html( $pages ) ?>
	<?php if ( '' !== $search ) : ?>
		: Search for <?= esc_html( $search ) ?>
	<?php endif; ?>
</h1>

<?php if ( $q->have_posts() ) : ?>
	<?php
	while ( $q->have_posts() ) :
		$q->the_post();

		// Run normal content filters (paragraphs, embeds, shortcodes) before injecting ads.
		$content = apply_filters( 'the_content', get_the_content() );

		// Escape the brackets: `[ad]` unescaped is a character class matching every "a" and "d".
		// Also swallow the <p></p> wpautop wraps around a marker on its own line,
		// so we don't output a <div> inside a <p>.
		$content = preg_replace_callback(
			'#<p>\s*\[ad\]\s*</p>|\[ad\]#',
			function () use ( &$ad_index ) {
				$ad_index++;
				// Return, don't echo: the return value is what replaces the match.
				return '<div class="ad ad-' . $ad_index . '"></div>'; // JS handler replaces with live ad
			},
			$content
		);
		?>
		<article>
			<h2><?= esc_html( get_the_title() ) ?></h2>
			<div class="entry-content"><?= $content // already filtered by the_content ?></div>
		</article>
	<?php endwhile; ?>
<?php else : ?>
	<p>
		No posts found<?php if ( '' !== $search ) : ?> for “<?= esc_html( $search ) ?>”<?php endif; ?>.
	</p>
<?php endif; ?>

<?php
// Restore the global $post for anything rendered after this loop.
wp_reset_postdata();
