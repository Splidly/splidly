import SwiftUI
import UIKit

@MainActor
final class ActivityListController: UICollectionViewController {
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private var sections: [ActivitySection] = []
  private var sectionsByKey: [String: ActivitySection] = [:]
  private var rows: [String: ActivityRow] = [:]
  private var completedRows: Set<String> = []
  private var pendingSwipe: (id: String, rowKey: String, complete: (Bool) -> Void)?
  private var lastCompletionId: String?
  private var onDeleteRequested: (String, String) -> Void = { _, _ in }
  private var onRefresh: (String) -> Void = { _ in }
  private var onScroll: ([String: Any]) -> Void = { _ in }
  private var onHostedLayout: (String, CGFloat) -> Void = { _, _ in }
  private var hostedWidths: [String: CGFloat] = [:]
  private var measuredWidthKeys: Set<String> = []
  private var initialMeasurementsComplete = false
  private var appliedHostedContent: [ActivityHostedContent] = []
  private var pendingRefreshId: String?
  private var shouldFinishRefresh = false
  private let refreshControl = UIRefreshControl()

  init() {
    super.init(collectionViewLayout: UICollectionViewFlowLayout())
    installsStandardGestureForInteractiveMovement = false
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override func viewDidLoad() {
    super.viewDidLoad()
    collectionView.dataSource = nil
    var configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    configuration.backgroundColor = .clear
    configuration.headerMode = .supplementary
    configuration.footerMode = .supplementary
    configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
      self?.swipeActions(at: indexPath)
    }
    let layout = UICollectionViewCompositionalLayout { [weak self] index, environment in
      guard let self, let model = self.section(at: index) else { return nil }
      let section = NSCollectionLayoutSection.list(
        using: configuration, layoutEnvironment: environment)
      let nativeBoundaries = section.boundarySupplementaryItems
      // The layout knows the native section width even before an empty
      // section creates a header view. Start Yoga measurement without needing
      // an expense row or a guessed screen width as a bootstrap placeholder.
      let width =
        environment.container.effectiveContentSize.width
        - section.contentInsets.leading - section.contentInsets.trailing
      let nativeHeader = nativeBoundaries.first {
        $0.elementKind == UICollectionView.elementKindSectionHeader
      }
      let nativeFooter = nativeBoundaries.first {
        $0.elementKind == UICollectionView.elementKindSectionFooter
      }
      if !model.isOverview {
        self.reportHostedWidth(
          model.header.key,
          width: width - (nativeHeader?.contentInsets.leading ?? 0)
            - (nativeHeader?.contentInsets.trailing ?? 0))
      }
      if let footer = model.footer {
        self.reportHostedWidth(
          footer.key,
          width: width - (nativeFooter?.contentInsets.leading ?? 0)
            - (nativeFooter?.contentInsets.trailing ?? 0))
      }
      if model.isOverview {
        // The overview is ordinary content, not a supplementary view anchored
        // above an expense section. Its measured frame begins at the list top,
        // including when the group has no expense rows.
        let size = NSCollectionLayoutSize(
          widthDimension: .fractionalWidth(1),
          heightDimension: .absolute(max(1, model.header.height)))
        let item = NSCollectionLayoutItem(layoutSize: size)
        let group = NSCollectionLayoutGroup.vertical(layoutSize: size, subitems: [item])
        let overview = NSCollectionLayoutSection(group: group)
        overview.contentInsets = NSDirectionalEdgeInsets(
          top: 8, leading: section.contentInsets.leading,
          bottom: 0, trailing: section.contentInsets.trailing)
        self.reportHostedWidth(model.header.key, width: width)
        if let content = model.footer {
          overview.boundarySupplementaryItems = [
            self.boundary(
              content, kind: UICollectionView.elementKindSectionFooter,
              alignment: .bottom, original: nativeFooter)
          ]
        }
        return overview
      }
      // Supplementary views do not inherit a cell's self-sizing behavior.
      // Reserve the actual Yoga height instead of letting the header paint
      // beyond UIKit's estimated frame and overlap the first expense.
      section.boundarySupplementaryItems = [
        self.boundary(
          model.header, kind: UICollectionView.elementKindSectionHeader,
          alignment: .top, original: nativeHeader)
      ]
      if let content = model.footer {
        section.boundarySupplementaryItems.append(
          self.boundary(
            content, kind: UICollectionView.elementKindSectionFooter,
            alignment: .bottom, original: nativeFooter))
      }
      return section
    }
    collectionView.setCollectionViewLayout(layout, animated: false)
    collectionView.backgroundColor = .clear
    collectionView.contentInsetAdjustmentBehavior = .automatic
    collectionView.keyboardDismissMode = .interactive
    collectionView.alwaysBounceVertical = true
    collectionView.delegate = self
    // Buttons and RN Pressables own row taps. UIKit selection would otherwise
    // leave a persistent selected background when a tap lands in empty space.
    collectionView.allowsSelection = false
    collectionView.selfSizingInvalidation = .enabledIncludingConstraints

    let cells = UICollectionView.CellRegistration<UICollectionViewListCell, String> {
      [weak self] cell, _, key in
      guard let row = self?.rows[key] else { return }
      if let hosted = row.hostedContent, let self {
        cell.contentConfiguration = self.hostedConfiguration(hosted)
      } else {
        cell.contentConfiguration = UIHostingConfiguration {
          row.content.buttonStyle(.plain).textSelection(.disabled)
        }
        .margins(.all, 0)
      }
    }
    let overviewCells = UICollectionView.CellRegistration<UICollectionViewCell, String> {
      [weak self] cell, _, key in
      guard let self, let content = self.rows[key]?.hostedContent else { return }
      cell.contentConfiguration = self.hostedConfiguration(content)
      cell.backgroundConfiguration = .clear()
    }
    dataSource = UICollectionViewDiffableDataSource<String, String>(collectionView: collectionView)
    { [weak self] collectionView, indexPath, key in
      guard let self else { return nil }
      if let overview = self.sections.first, overview.isOverview, overview.header.key == key {
        return collectionView.dequeueConfiguredReusableCell(
          using: overviewCells, for: indexPath, item: key)
      }
      return collectionView.dequeueConfiguredReusableCell(using: cells, for: indexPath, item: key)
    }
    let headers = UICollectionView.SupplementaryRegistration<UICollectionViewCell>(
      elementKind: UICollectionView.elementKindSectionHeader
    ) { [weak self] cell, _, indexPath in
      guard let self, let section = self.section(at: indexPath.section) else { return }
      cell.contentConfiguration = self.hostedConfiguration(section.header)
      cell.backgroundConfiguration = .clear()
    }
    let footers = UICollectionView.SupplementaryRegistration<UICollectionViewCell>(
      elementKind: UICollectionView.elementKindSectionFooter
    ) { [weak self] cell, _, indexPath in
      guard let self, let section = self.section(at: indexPath.section) else { return }
      if let footer = section.footer {
        cell.contentConfiguration = self.hostedConfiguration(footer)
      } else {
        cell.contentConfiguration = UIHostingConfiguration { EmptyView() }.margins(.all, 0)
      }
      cell.backgroundConfiguration = .clear()
    }
    dataSource.supplementaryViewProvider = { collectionView, kind, indexPath in
      collectionView.dequeueConfiguredReusableSupplementary(
        using: kind == UICollectionView.elementKindSectionHeader ? headers : footers,
        for: indexPath
      )
    }
    refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)
  }

  func update(
    sections: [ActivitySection],
    completion: ActivitySwipeResult?,
    refreshCompletion: String?,
    refreshEnabled: Bool,
    bounces: Bool,
    onDeleteRequested: @escaping (String, String) -> Void,
    onRefresh: @escaping (String) -> Void,
    onScroll: @escaping ([String: Any]) -> Void,
    onHostedLayout: @escaping (String, CGFloat) -> Void
  ) {
    loadViewIfNeeded()
    self.sections = sections
    // Keep models for outgoing sections until UIKit finishes its snapshot.
    // Layout and supplementary indices belong to that snapshot, not React's
    // latest section array during an insertion or deletion.
    for section in sections { sectionsByKey[section.key] = section }
    self.onDeleteRequested = onDeleteRequested
    self.onRefresh = onRefresh
    self.onScroll = onScroll
    self.onHostedLayout = onHostedLayout
    collectionView.bounces = bounces
    collectionView.alwaysBounceVertical = bounces
    let desiredRefreshControl = refreshEnabled ? refreshControl : nil
    if collectionView.refreshControl !== desiredRefreshControl {
      collectionView.refreshControl = desiredRefreshControl
    }
    if let refreshCompletion, refreshCompletion == pendingRefreshId {
      pendingRefreshId = nil
      shouldFinishRefresh = true
    }
    defer { finishRefreshIfNotDragging() }

    let currentKeys = Set(sections.flatMap(\.rows).map(\.key))
    completedRows.formIntersection(currentKeys)
    if let completion, completion.requestId != lastCompletionId {
      lastCompletionId = completion.requestId
      if let pending = pendingSwipe, pending.id == completion.requestId {
        pendingSwipe = nil
        if completion.deleted {
          completedRows.insert(pending.rowKey)
          applySnapshot { pending.complete(true) }
        } else {
          pending.complete(false)
          applySnapshot()
        }
        return
      }
    }
    // Keep the native list's data source stable while UIKit waits for the
    // confirmation and server result. React query updates must not end the swipe.
    if pendingSwipe == nil { applySnapshot() }
  }

  private func applySnapshot(completion: (() -> Void)? = nil) {
    rows = Dictionary(uniqueKeysWithValues: sections.flatMap(\.rows).map { ($0.key, $0) })
    for section in sections where section.isOverview {
      rows[section.header.key] = ActivityRow(
        key: section.header.key, content: AnyView(EmptyView()), hostedContent: section.header,
        canDelete: false, deletionDisabled: false)
    }
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()
    let canAnimate = initialMeasurementsComplete
    // Only the overview must finish measuring before the first insertion.
    // Offscreen date headers must not block a long list from being displayed.
    if let first = sections.first, first.header.height > 0 {
      initialMeasurementsComplete = true
    }
    for section in sections {
      snapshot.appendSections([section.key])
      snapshot.appendItems(
        section.isOverview
          ? [section.header.key]
          : initialMeasurementsComplete
            ? section.rows.map(\.key).filter { !completedRows.contains($0) }
            : [],
        toSection: section.key
      )
    }
    let previous = dataSource.snapshot()
    let changed =
      previous.sectionIdentifiers != snapshot.sectionIdentifiers
      || previous.itemIdentifiers != snapshot.itemIdentifiers
    let hostedContent = sections.flatMap { section in
      [section.header] + section.rows.compactMap(\.hostedContent)
        + (section.footer.map { [$0] } ?? [])
    }
    let hostedLayoutChanged = hostedContent != appliedHostedContent
    // Expo's child views observe their React props themselves. A refresh-state
    // or navigation-title update must not recreate every cell and invalidate
    // the collection layout during a pull gesture.
    guard changed || hostedLayoutChanged else {
      completion?()
      return
    }
    let previousHosted = Dictionary(uniqueKeysWithValues: appliedHostedContent.map { ($0.key, $0) })
    let retained = Set(previous.itemIdentifiers).intersection(snapshot.itemIdentifiers)
    let hostedRowsToUpdate = retained.filter { key in
      guard let content = rows[key]?.hostedContent else { return changed }
      return previousHosted[content.key] != content
    }
    appliedHostedContent = hostedContent
    if !changed {
      UIView.performWithoutAnimation {
        for key in hostedRowsToUpdate {
          if let indexPath = dataSource.indexPath(for: key),
            let cell = collectionView.cellForItem(at: indexPath),
            let content = rows[key]?.hostedContent
          {
            cell.contentConfiguration = hostedConfiguration(content)
          }
        }
        updateVisibleSupplementaries()
      }
      completion?()
      return
    }
    snapshot.reconfigureItems(Array(hostedRowsToUpdate))
    let overviewKeys = Set(sections.filter(\.isOverview).map(\.header.key))
    let hadActivity = previous.itemIdentifiers.contains { !overviewKeys.contains($0) }
    let hasActivity = snapshot.itemIdentifiers.contains { !overviewKeys.contains($0) }
    dataSource.apply(
      snapshot, animatingDifferences: canAnimate && hadActivity && hasActivity
    ) { [weak self] in
      if let self {
        UIView.performWithoutAnimation { self.updateVisibleSupplementaries() }
        let retainedKeys = Set(self.sections.map(\.key)).union(
          self.dataSource.snapshot().sectionIdentifiers)
        self.sectionsByKey = self.sectionsByKey.filter { retainedKeys.contains($0.key) }
      }
      completion?()
    }
  }

  private func hostedConfiguration(_ content: ActivityHostedContent) -> ActivityHostedConfiguration
  {
    ActivityHostedConfiguration(content: content) { [weak self] key, width in
      self?.reportHostedWidth(key, width: width, measured: true)
    }
  }

  private func reportHostedWidth(_ key: String, width: CGFloat, measured: Bool = false) {
    if measured {
      measuredWidthKeys.insert(key)
    } else if measuredWidthKeys.contains(key) {
      return
    }
    guard width > 0, hostedWidths[key] != width else { return }
    hostedWidths[key] = width
    onHostedLayout(key, width)
  }

  private func boundary(
    _ content: ActivityHostedContent, kind: String, alignment: NSRectAlignment,
    original: NSCollectionLayoutBoundarySupplementaryItem?
  ) -> NSCollectionLayoutBoundarySupplementaryItem {
    let insets = original?.contentInsets ?? .zero
    let measured = NSCollectionLayoutBoundarySupplementaryItem(
      layoutSize: NSCollectionLayoutSize(
        widthDimension: original?.layoutSize.widthDimension ?? .fractionalWidth(1),
        heightDimension: .absolute(max(1, content.height) + insets.top + insets.bottom)),
      elementKind: kind, alignment: original?.alignment ?? alignment,
      absoluteOffset: original?.offset ?? .zero)
    measured.contentInsets = insets
    measured.edgeSpacing = original?.edgeSpacing
    measured.extendsBoundary = true
    measured.pinToVisibleBounds = false
    measured.zIndex = original?.zIndex ?? 0
    return measured
  }

  private func section(at index: Int) -> ActivitySection? {
    guard let key = dataSource?.sectionIdentifier(for: index) else { return nil }
    return sectionsByKey[key]
  }

  private func updateVisibleSupplementaries() {
    collectionView.collectionViewLayout.invalidateLayout()
    collectionView.layoutIfNeeded()
    for kind in [
      UICollectionView.elementKindSectionHeader, UICollectionView.elementKindSectionFooter,
    ] {
      for indexPath in collectionView.indexPathsForVisibleSupplementaryElements(ofKind: kind) {
        guard let section = section(at: indexPath.section),
          let cell = collectionView.supplementaryView(forElementKind: kind, at: indexPath)
            as? UICollectionViewCell
        else { continue }
        let content =
          kind == UICollectionView.elementKindSectionHeader ? section.header : section.footer
        if let content,
          (cell.contentConfiguration as? ActivityHostedConfiguration)?.content != content
        {
          cell.contentConfiguration = hostedConfiguration(content)
          cell.setNeedsLayout()
        }
      }
    }
  }

  private func swipeActions(at indexPath: IndexPath) -> UISwipeActionsConfiguration? {
    guard pendingSwipe == nil,
      let key = dataSource.itemIdentifier(for: indexPath),
      let row = rows[key], row.canDelete, !row.deletionDisabled
    else { return nil }
    let delete = UIContextualAction(style: .destructive, title: "Delete") {
      [weak self] _, _, complete in
      guard let self, self.pendingSwipe == nil,
        let row = self.rows[key], !row.deletionDisabled
      else {
        complete(false)
        return
      }
      let requestId = UUID().uuidString
      self.pendingSwipe = (requestId, key, complete)
      self.onDeleteRequested(key, requestId)
      // UIKit owns the entire swipe animation. Complete only after the dialog
      // and mutation resolve, so Cancel restores the row rather than hiding it.
    }
    delete.image = UIImage(systemName: "trash")
    let configuration = UISwipeActionsConfiguration(actions: [delete])
    configuration.performsFirstActionWithFullSwipe = true
    return configuration
  }

  func cancelPendingSwipe() {
    let pending = pendingSwipe
    pendingSwipe = nil
    pending?.complete(false)
  }

  @objc private func refresh() {
    guard pendingRefreshId == nil, !shouldFinishRefresh else { return }
    let requestId = UUID().uuidString
    pendingRefreshId = requestId
    onRefresh(requestId)
  }

  private func finishRefreshIfNotDragging() {
    guard shouldFinishRefresh, !collectionView.isDragging else { return }
    shouldFinishRefresh = false
    refreshControl.endRefreshing()
  }

  override func scrollViewDidEndDragging(
    _ scrollView: UIScrollView, willDecelerate decelerate: Bool
  ) {
    finishRefreshIfNotDragging()
  }

  override func scrollViewDidScroll(_ scrollView: UIScrollView) {
    onScroll([
      "contentOffset": ["x": scrollView.contentOffset.x, "y": scrollView.contentOffset.y],
      "contentInset": [
        "top": scrollView.adjustedContentInset.top,
        "bottom": scrollView.adjustedContentInset.bottom,
        "left": scrollView.adjustedContentInset.left,
        "right": scrollView.adjustedContentInset.right,
      ],
      "contentSize": [
        "width": scrollView.contentSize.width, "height": scrollView.contentSize.height,
      ],
      "layoutMeasurement": ["width": scrollView.bounds.width, "height": scrollView.bounds.height],
      "zoomScale": 1,
    ])
  }
}
